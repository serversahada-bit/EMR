import "server-only";

import type { CSSProperties } from "react";

import { panggil, rangeTab } from "./sheet-sync/sheets-client";

/* ──────────────────────────────────────────────────────────────
   Spreadsheet live — tampilkan tab Google Sheets apa adanya.

   Google Sheets API (includeGridData) mengirim nilai yang sudah
   TERFORMAT ("Rp571.860.085") beserta format tiap sel: warna, tebal,
   rata, garis, sel gabungan, lebar kolom, tinggi baris, dan
   kolom/baris tersembunyi. Semuanya digambar ulang sebagai tabel HTML
   supaya bentuknya sama dengan sheet aslinya.

   Format yang dibaca adalah `effectiveFormat` — format AKHIR sel,
   sudah termasuk hasil conditional formatting.

   Hanya sheet "Anyone with the link" yang bisa dibaca (API key).
   ────────────────────────────────────────────────────────────── */

/** Lama data disimpan di server. Layar menyegarkan tiap 60 detik, jadi
 *  tiap penyegaran otomatis selalu mendapat data baru dari Google. */
const SEGAR_MS = 45_000;
/** Batas ukuran yang diambil: tab laporan biasanya ±100 baris × 30 kolom.
 *  Satu tab utuh 1.000 baris membuat respons Google puluhan MB. */
const MAKS_BARIS = 400;
const MAKS_KOLOM = 60;

const memo = new Map<string, { pada: number; nilai: Promise<unknown> }>();

/** Promise disimpan (bukan hasilnya) agar beberapa pengguna yang membuka
 *  bersamaan memakai satu panggilan ke Google. Galat tidak disimpan. */
function denganMemo<T>(kunci: string, ambil: () => Promise<T>): Promise<T> {
  const ada = memo.get(kunci);
  if (ada && Date.now() - ada.pada < SEGAR_MS) return ada.nilai as Promise<T>;
  if (memo.size > 50) memo.delete(memo.keys().next().value as string);
  const nilai = ambil();
  memo.set(kunci, { pada: Date.now(), nilai });
  nilai.catch(() => memo.delete(kunci));
  return nilai;
}

/* ── daftar tab ─────────────────────────────────────────────── */

export interface TabSheet {
  id: number;
  judul: string;
  baris: number;
  kolom: number;
}

export interface InfoFile {
  judul: string;
  tab: TabSheet[];
}

interface ApiInfo {
  properties?: { title?: string };
  sheets?: {
    properties?: {
      sheetId?: number;
      title?: string;
      hidden?: boolean;
      sheetType?: string;
      gridProperties?: { rowCount?: number; columnCount?: number };
    };
  }[];
}

/** Judul file dan tab yang terlihat (tab tersembunyi & tab grafik dilewati). */
export function infoFile(id: string): Promise<InfoFile> {
  return denganMemo(`info:${id}`, async () => {
    const r = await panggil<ApiInfo>(id, {
      fields:
        "properties.title,sheets.properties(sheetId,title,hidden,sheetType,gridProperties(rowCount,columnCount))",
    });
    return {
      judul: r.properties?.title ?? id,
      tab: (r.sheets ?? [])
        .map((s) => s.properties ?? {})
        .filter((p) => !p.hidden && (p.sheetType ?? "GRID") === "GRID")
        .map((p) => ({
          id: p.sheetId ?? 0,
          judul: p.title ?? "",
          baris: p.gridProperties?.rowCount ?? 0,
          kolom: p.gridProperties?.columnCount ?? 0,
        })),
    };
  });
}

/* ── isi tab ────────────────────────────────────────────────── */

export interface KolomGrid {
  huruf: string;
  lebar: number;
}

export interface SelGrid {
  teks: string;
  gaya: CSSProperties;
  rowSpan: number;
  colSpan: number;
}

export interface BarisGrid {
  nomor: number;
  tinggi: number;
  /** null = sel tertutup oleh sel gabungan di atas/kirinya. */
  sel: (SelGrid | null)[];
}

export interface GridSheet {
  kolom: KolomGrid[];
  baris: BarisGrid[];
  /** Isi tab melewati batas MAKS_BARIS × MAKS_KOLOM, jadi sebagian tidak tampil. */
  terpotong: boolean;
  diambil: string;
}

interface Warna {
  red?: number;
  green?: number;
  blue?: number;
}
interface Garis {
  style?: string;
  color?: Warna;
}
interface ApiSel {
  formattedValue?: string;
  effectiveValue?: { numberValue?: number };
  effectiveFormat?: {
    backgroundColor?: Warna;
    horizontalAlignment?: string;
    verticalAlignment?: string;
    wrapStrategy?: string;
    textFormat?: {
      bold?: boolean;
      italic?: boolean;
      strikethrough?: boolean;
      underline?: boolean;
      fontSize?: number;
      foregroundColor?: Warna;
    };
    borders?: { top?: Garis; bottom?: Garis; left?: Garis; right?: Garis };
  };
}
interface ApiGrid {
  sheets?: {
    merges?: {
      startRowIndex?: number;
      endRowIndex?: number;
      startColumnIndex?: number;
      endColumnIndex?: number;
    }[];
    data?: {
      rowMetadata?: { pixelSize?: number; hiddenByUser?: boolean; hiddenByFilter?: boolean }[];
      columnMetadata?: { pixelSize?: number; hiddenByUser?: boolean }[];
      rowData?: { values?: ApiSel[] }[];
    }[];
  }[];
}

const FIELDS =
  "sheets(merges,data(rowMetadata(pixelSize,hiddenByUser,hiddenByFilter)," +
  "columnMetadata(pixelSize,hiddenByUser),rowData(values(formattedValue," +
  "effectiveValue(numberValue),effectiveFormat(backgroundColor,horizontalAlignment," +
  "verticalAlignment,wrapStrategy,textFormat(bold,italic,strikethrough,underline," +
  "fontSize,foregroundColor),borders)))))";

/** 0 → "A", 26 → "AA". */
function hurufKolom(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

/** Warna API → CSS. Komponen yang tidak dikirim bernilai 0 ({} = hitam). */
function warna(c: Warna | undefined): string | undefined {
  if (!c) return undefined;
  const k = (v: number | undefined) => Math.round((v ?? 0) * 255);
  return `rgb(${k(c.red)} ${k(c.green)} ${k(c.blue)})`;
}

const putih = (c: Warna | undefined) =>
  !c || ((c.red ?? 0) > 0.99 && (c.green ?? 0) > 0.99 && (c.blue ?? 0) > 0.99);

function garis(g: Garis | undefined): string | undefined {
  if (!g?.style || g.style === "NONE") return undefined;
  const tebal = g.style === "SOLID_THICK" || g.style === "DOUBLE" ? 3 : g.style === "SOLID_MEDIUM" ? 2 : 1;
  const jenis =
    g.style === "DASHED" ? "dashed" : g.style === "DOTTED" ? "dotted" : g.style === "DOUBLE" ? "double" : "solid";
  return `${tebal}px ${jenis} ${warna(g.color) ?? "rgb(0 0 0)"}`;
}

const ada = (s: ApiSel | undefined) =>
  Boolean(s?.formattedValue) || !putih(s?.effectiveFormat?.backgroundColor);

/** Isi satu tab, siap digambar. */
export function gridTab(id: string, tab: TabSheet): Promise<GridSheet> {
  return denganMemo(`grid:${id}:${tab.id}`, async () => {
    const nBaris = Math.max(1, Math.min(tab.baris, MAKS_BARIS));
    const nKolom = Math.max(1, Math.min(tab.kolom, MAKS_KOLOM));
    const r = await panggil<ApiGrid>(id, {
      ranges: rangeTab(tab.judul, `A1:${hurufKolom(nKolom - 1)}${nBaris}`),
      includeGridData: "true",
      fields: FIELDS,
    });

    const sheet = r.sheets?.[0];
    const data = sheet?.data?.[0] ?? {};
    const rows = data.rowData ?? [];
    const sel = (b: number, k: number) => rows[b]?.values?.[k];

    /* Potong baris/kolom kosong di ujung — sheet laporan biasanya
       1.000 baris tapi isinya hanya ±100. */
    let akhirB = -1;
    let akhirK = -1;
    rows.forEach((row, b) =>
      (row.values ?? []).forEach((s, k) => {
        if (ada(s)) {
          akhirB = Math.max(akhirB, b);
          akhirK = Math.max(akhirK, k);
        }
      }),
    );

    const barisTampil: number[] = [];
    for (let b = 0; b <= akhirB; b++) {
      const m = data.rowMetadata?.[b];
      if (!m?.hiddenByUser && !m?.hiddenByFilter) barisTampil.push(b);
    }
    const kolomTampil: number[] = [];
    for (let k = 0; k <= akhirK; k++) {
      if (!data.columnMetadata?.[k]?.hiddenByUser) kolomTampil.push(k);
    }

    /* Sel gabungan: jangkar = sel TERLIHAT pertama di dalam rentangnya
       (bisa bukan pojok kiri atas kalau baris/kolom awalnya tersembunyi),
       isinya tetap dari pojok kiri atas. Sel lain di rentang ditutup. */
    const jangkar = new Map<string, { rs: number; cs: number; asal: [number, number] }>();
    const tertutup = new Set<string>();
    for (const m of sheet?.merges ?? []) {
      const b0 = m.startRowIndex ?? 0;
      const k0 = m.startColumnIndex ?? 0;
      const vb = barisTampil.filter((b) => b >= b0 && b < (m.endRowIndex ?? b0 + 1));
      const vk = kolomTampil.filter((k) => k >= k0 && k < (m.endColumnIndex ?? k0 + 1));
      if (vb.length === 0 || vk.length === 0) continue;
      jangkar.set(`${vb[0]},${vk[0]}`, { rs: vb.length, cs: vk.length, asal: [b0, k0] });
      for (const b of vb) for (const k of vk) if (b !== vb[0] || k !== vk[0]) tertutup.add(`${b},${k}`);
    }

    const baris: BarisGrid[] = barisTampil.map((b) => ({
      nomor: b + 1,
      tinggi: data.rowMetadata?.[b]?.pixelSize ?? 21,
      sel: kolomTampil.map((k, posisi) => {
        const kunci = `${b},${k}`;
        if (tertutup.has(kunci)) return null;
        const j = jangkar.get(kunci);
        const s = j ? sel(j.asal[0], j.asal[1]) : sel(b, k);
        const f = s?.effectiveFormat ?? {};
        const t = f.textFormat ?? {};
        const angka = s?.effectiveValue?.numberValue !== undefined;
        const bungkus = f.wrapStrategy === "WRAP";
        const rata =
          f.horizontalAlignment === "CENTER" ? "center"
          : f.horizontalAlignment === "RIGHT" ? "right"
          : f.horizontalAlignment === "LEFT" ? "left"
          : angka ? "right" : "left";

        /* Teks panjang meluber ke kanan seperti di Sheets — hanya bila
           rata kiri, bukan angka, tidak dibungkus, bukan sel gabungan,
           dan sel di kanannya kosong. Selain itu dipotong. */
        const kanan = kolomTampil[posisi + 1];
        const boleh =
          !bungkus && !angka && rata === "left" && !j &&
          kanan !== undefined && !sel(b, kanan)?.formattedValue && !tertutup.has(`${b},${kanan}`);

        /* Hanya yang BERBEDA dari bawaan tabel (rata kiri, rata bawah,
           tidak dibungkus, dipotong — lihat TabelSheet). Tab laporan punya
           ±3.400 sel; gaya bawaan yang diulang di tiap sel membuat
           halamannya 864 KB per penyegaran. */
        const gaya: CSSProperties = {};
        if (rata !== "left") gaya.textAlign = rata;
        if (f.verticalAlignment === "TOP") gaya.verticalAlign = "top";
        if (f.verticalAlignment === "MIDDLE") gaya.verticalAlign = "middle";
        if (bungkus) gaya.whiteSpace = "pre-wrap";
        if (boleh) gaya.overflow = "visible";
        if (!putih(f.backgroundColor)) gaya.backgroundColor = warna(f.backgroundColor);
        /* Hitam = bawaan tabel, tidak perlu ditulis per sel. */
        const hitam =
          (t.foregroundColor?.red ?? 0) < 0.01 &&
          (t.foregroundColor?.green ?? 0) < 0.01 &&
          (t.foregroundColor?.blue ?? 0) < 0.01;
        if (t.foregroundColor && !hitam) gaya.color = warna(t.foregroundColor);
        if (t.bold) gaya.fontWeight = 700;
        if (t.italic) gaya.fontStyle = "italic";
        const hias = [t.underline && "underline", t.strikethrough && "line-through"].filter(Boolean);
        if (hias.length) gaya.textDecoration = hias.join(" ");
        if (t.fontSize && t.fontSize !== 10) gaya.fontSize = `${t.fontSize}pt`;
        const g = f.borders ?? {};
        const [atas, bawah, kiri, kanan_] = [garis(g.top), garis(g.bottom), garis(g.left), garis(g.right)];
        if (atas && atas === bawah && atas === kiri && atas === kanan_) {
          gaya.border = atas; // empat sisi sama → satu deklarasi
        } else {
          if (atas) gaya.borderTop = atas;
          if (bawah) gaya.borderBottom = bawah;
          if (kiri) gaya.borderLeft = kiri;
          if (kanan_) gaya.borderRight = kanan_;
        }

        return { teks: s?.formattedValue ?? "", gaya, rowSpan: j?.rs ?? 1, colSpan: j?.cs ?? 1 };
      }),
    }));

    return {
      kolom: kolomTampil.map((k) => ({
        huruf: hurufKolom(k),
        lebar: data.columnMetadata?.[k]?.pixelSize ?? 100,
      })),
      baris,
      /* Hanya bila ISI mencapai batas — tab 1.000 baris yang isinya
         ±100 baris tidak terpotong. */
      terpotong:
        (tab.baris > nBaris && akhirB >= nBaris - 1) ||
        (tab.kolom > nKolom && akhirK >= nKolom - 1),
      diambil: new Date().toISOString(),
    };
  });
}
