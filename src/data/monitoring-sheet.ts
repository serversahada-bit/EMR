import "server-only";

import type { BarisMonitoring } from "./monitoring-queries";
import { panggil, rangeTab } from "./sheet-sync/sheets-client";

/* ──────────────────────────────────────────────────────────────
   Marketing Report dibaca LIVE dari Google Sheets — pengganti impor
   manual `impor_monitoring.py` ke tabel data_monitoring_kanal.

   Sheet itu sendiri realtime: angkanya ditarik dengan IMPORTRANGE dari
   file Progres tiap produk. Membaca tabel impor membuat halaman
   tertinggal sejak impor terakhir (Oktober 2026: biaya baru s/d ±20 Okt,
   COS tampak 31,6% padahal ±39%).

   Pengurai ini SALINAN logika impor_monitoring.py, supaya angkanya sama
   dengan data yang selama ini diimpor:
   - Tiap tab "<BULAN> -<tahun> GENERAL MONITORING" berisi blok per
     produk. Blok diawali baris "<BULAN> | <PRODUK>" di kolom B–C, lalu
     baris header kanal (baris pertama yang memuat "TOTAL"), lalu baris
     berlabel ALOKASI / REALISASI SPEND / BOX / CLOSING / CPA / OMSET.
   - Semua dibaca lewat LABEL, bukan posisi: tim yang menyisipkan baris
     tidak membuat angka tergeser.
   - Bulan dari NAMA TAB — label bulan di dalam tab sering basi (tab
     Oktober masih bertuliskan "AGUSTUS").
   - Kotak TARGET/KPI di kanan blok: kolom J = target box (baris BOX) dan
     batas COS (baris CPA); K & M = batas COS META x ECOMMERCE dan SOSCOM
     bila berupa teks ber-% ("SOSCOM <=27,22%").
   Satu perbaikan dibanding skrip: header "AKUSISI" (salah ketik di blok
   Gamamilk Sereal) dikenali sebagai META. Skrip melewatkannya, sehingga
   biaya Meta Sereal tidak pernah ikut.
   ────────────────────────────────────────────────────────────── */

/** File Marketing Report per tahun. Tahun baru = tambah satu baris. */
const SHEET_PER_TAHUN: Record<number, string> = {
  2026: "1exWK1q1ZihE171pN3lkq0i8g7dflAhNE18LyvEpyQos",
};

const SEGAR_MS = 45_000;

const BULAN = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER",
];
const PRODUK: Record<string, string> = {
  GAMAMILK: "Gamamilk",
  "GAMAMILK PREMIUM": "Gamamilk Premium",
  GMP: "Gamamilk Premium",
  "GAMAMILK PLUS": "Gamamilk Plus",
  "GAMAMILK SEREAL": "Gamamilk Sereal",
  PHENOBODY: "Phenobody",
  PHENO: "Phenobody",
  GNAIT: "G'Nait",
  "G'NAIT": "G'Nait",
  EC: "Etacefit",
  ETACEFIT: "Etacefit",
};
const GABUNGAN = new Set(["ALL BRAND", "SEMUA BRAND"]);
const KANAL: Record<string, [string, string]> = {
  METAXSHOPEE: ["META x SHOPEE", "ECOMMERCE"],
  TIKTOK: ["TIKTOK", "ECOMMERCE"],
  MP: ["MP", "ECOMMERCE"],
  META: ["META", "SOSCOM"],
  AKUISISI: ["META", "SOSCOM"],
  AKUSISI: ["META", "SOSCOM"],
  SNACK: ["SNACK", "SOSCOM"],
  CRM: ["CRM", "SOSCOM"],
  MBC: ["MARKOM", "LAIN"],
  MARKOM: ["MARKOM", "LAIN"],
  TOTAL: ["TOTAL", "TOTAL"],
};
type Metrik = "alokasi" | "spend" | "box" | "closing" | "cos" | "omset";
const METRIK: [string, Metrik][] = [
  ["ALOKASI", "alokasi"],
  ["REALISASI", "spend"],
  ["BOX", "box"],
  ["CLOSING", "closing"],
  ["CPA", "cos"],
  ["OMSET", "omset"],
];

const up = (v: unknown) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().toUpperCase() : "";
/** Sel galat (#DIV/0!) datang sebagai teks → dianggap kosong. */
const angka = (v: unknown) => (typeof v === "number" ? v : null);
/** "≤ 40,56%" / "SOSCOM <=27,22%" / 0,35 → 0,4056 / 0,2722 / 0,35 */
function persen(v: unknown): number | null {
  if (typeof v === "number") return v < 1.5 ? v : v / 100;
  const m = /(\d+(?:[.,]\d+)?)\s*%/.exec(String(v ?? ""));
  return m ? Number(m[1].replace(",", ".")) / 100 : null;
}

/** "OKTOBER -2026 GENERAL MONITORING" → "2026-10"; null bila bukan tab bulanan. */
function bulanDariTab(tab: string): string | null {
  const m = /^\s*([A-Z]+)\s*-?\s*(20\d\d)/.exec(tab.toUpperCase());
  const i = m ? BULAN.indexOf(m[1]) : -1;
  return i < 0 ? null : `${m![2]}-${String(i + 1).padStart(2, "0")}`;
}

function uraiTab(tab: string, v: unknown[][]): { rows: BarisMonitoring[]; catatan: string[] } {
  const sel = (r: unknown[] | undefined, j: number) => (r && j < r.length ? r[j] : null);
  const awal = v.flatMap((r, i) => (BULAN.includes(up(sel(r, 1))) && up(sel(r, 2)) ? [i] : []));
  const rows: BarisMonitoring[] = [];
  const catatan: string[] = [];

  awal.forEach((i, n) => {
    const nama = up(sel(v[i], 2));
    const akhir = n + 1 < awal.length ? awal[n + 1] : Math.min(v.length, i + 20);
    let h = -1;
    for (let x = i + 1; x < Math.min(i + 5, akhir); x++) {
      if ((v[x] ?? []).some((c) => up(c) === "TOTAL")) {
        h = x;
        break;
      }
    }
    if (h < 0) {
      catatan.push(`${tab.trim()} / ${nama}: header kanal tidak ketemu — blok dilewati`);
      return;
    }

    const kolom = new Map<number, [string, string]>();
    (v[h] ?? []).forEach((c, j) => {
      const k = KANAL[up(c).replace(/ /g, "")];
      if (k) kolom.set(j, k);
    });

    const nilai = new Map<number, Partial<Record<Metrik, number | null>>>();
    for (const j of kolom.keys()) nilai.set(j, {});
    const target: Pick<BarisMonitoring, "targetBox" | "targetCos" | "targetCosEcom" | "targetCosSoscom"> = {
      targetBox: null,
      targetCos: null,
      targetCosEcom: null,
      targetCosSoscom: null,
    };
    let adaTargetBox = false;
    let adaTargetCos = false;

    for (let x = h + 1; x < akhir; x++) {
      const lab = up(sel(v[x], 1));
      const met = METRIK.find(([awalan]) => lab.startsWith(awalan))?.[1];
      if (!met) continue;
      if (met === "box" && !adaTargetBox) {
        target.targetBox = angka(sel(v[x], 9));
        adaTargetBox = true;
      }
      if (met === "cos" && !adaTargetCos) {
        target.targetCos = persen(sel(v[x], 9));
        const k = sel(v[x], 10);
        const m = sel(v[x], 12);
        target.targetCosEcom = typeof k === "string" ? persen(k) : null;
        target.targetCosSoscom = typeof m === "string" ? persen(m) : null;
        adaTargetCos = true;
      }
      for (const [j, isi] of nilai) {
        if (!(met in isi)) isi[met] = angka(sel(v[x], j));
      }
    }

    const produk = GABUNGAN.has(nama) ? "ALL BRAND" : PRODUK[nama];
    if (!produk) {
      catatan.push(`${tab.trim()}: produk "${nama}" tidak dikenal — dilewati`);
      return;
    }
    for (const [j, [kanal, grup]] of kolom) {
      const isi = nilai.get(j) ?? {};
      if (!isi.alokasi && !isi.spend && !isi.box && !isi.omset) continue;
      const total = kanal === "TOTAL";
      rows.push({
        produk,
        kanal,
        grup,
        agregat: total ? 1 : 0,
        alokasi: isi.alokasi ?? null,
        spend: isi.spend ?? null,
        box: isi.box ?? null,
        closing: isi.closing ?? null,
        omset: isi.omset ?? null,
        targetBox: total ? target.targetBox : null,
        targetCos: total ? target.targetCos : null,
        targetCosEcom: total ? target.targetCosEcom : null,
        targetCosSoscom: total ? target.targetCosSoscom : null,
      });
    }
  });

  if (!rows.some((r) => r.produk === "ALL BRAND" && r.agregat)) {
    catatan.push(`${tab.trim()}: blok ALL BRAND tidak terbaca`);
  }
  return { rows, catatan };
}

export interface MonitoringLive {
  judul: string;
  /** "YYYY-MM" → baris bulan itu. Hanya bulan yang terbaca lengkap. */
  perBulan: Map<string, BarisMonitoring[]>;
  catatan: string[];
  diambil: string;
}

/** Per tahun — tren bisa meminta 2025 dan 2026 bergantian. */
const memo = new Map<number, { pada: number; nilai: Promise<MonitoringLive | null> }>();

/**
 * Semua tab bulanan satu tahun, dalam SATU panggilan batchGet.
 * Null bila tahun itu belum punya sheet terdaftar. Galat (sheet ditutup,
 * jaringan putus) dilempar — pemanggil memakai tabel impor sebagai cadangan.
 */
export function monitoringLive(tahun: number): Promise<MonitoringLive | null> {
  const ada = memo.get(tahun);
  if (ada && Date.now() - ada.pada < SEGAR_MS) return ada.nilai;
  const id = SHEET_PER_TAHUN[tahun];
  const nilai: Promise<MonitoringLive | null> = !id
    ? Promise.resolve(null)
    : (async () => {
        const info = await panggil<{ properties?: { title?: string }; sheets?: { properties?: { title?: string } }[] }>(
          id,
          { fields: "properties.title,sheets.properties.title" },
        );
        const tabs = (info.sheets ?? [])
          .map((s) => s.properties?.title ?? "")
          .filter((t) => t.toUpperCase().includes("GENERAL MONITORING") && !t.trim().startsWith("("));
        const isi = await panggil<{ valueRanges?: { values?: unknown[][] }[] }>(`${id}/values:batchGet`, {
          ranges: tabs.map((t) => rangeTab(t, "A1:N220")),
          valueRenderOption: "UNFORMATTED_VALUE",
        });

        const perBulan = new Map<string, BarisMonitoring[]>();
        const catatan: string[] = [];
        tabs.forEach((tab, i) => {
          const bulan = bulanDariTab(tab);
          if (!bulan) return;
          const hasil = uraiTab(tab, isi.valueRanges?.[i]?.values ?? []);
          catatan.push(...hasil.catatan);
          /* Bulan tanpa blok ALL BRAND dianggap tidak terbaca utuh —
             halaman memakai tabel impor untuk bulan itu. */
          if (hasil.rows.some((r) => r.produk === "ALL BRAND" && r.agregat)) perBulan.set(bulan, hasil.rows);
        });
        return { judul: info.properties?.title ?? id, perBulan, catatan, diambil: new Date().toISOString() };
      })();
  memo.set(tahun, { pada: Date.now(), nilai });
  nilai.catch(() => {
    if (memo.get(tahun)?.nilai === nilai) memo.delete(tahun);
  });
  return nilai;
}
