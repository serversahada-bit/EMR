/* ──────────────────────────────────────────────────────────────
   Array dua dimensi dari Sheets API → baris siap tulis.

   Murni: tidak menyentuh database, tidak membaca environment. Semua
   keputusan "baris ini dilewati / salah / dipakai" diambil di sini
   supaya bisa diuji tanpa koneksi apa pun.
   ────────────────────────────────────────────────────────────── */

import {
  HEADER_MAP,
  HEADER_PENANDA,
  KOLOM_TANGGAL,
  KOLOM_TIMESTAMP,
  KOLOM_UANG,
  normalizeHeader,
} from "./header-map";
import {
  normalizeHp,
  normalizeNama,
  normalizeTanggal,
  normalizeTimestamp,
  normalizeUang,
  tersensor,
} from "./normalize";

export interface BarisTerurai {
  /** Nomor baris sebagaimana terlihat di sheet (1-based). */
  nomorBaris: number;
  /** Kolom tabel → nilai siap tulis. */
  kolom: Record<string, string | null>;
  kodeBooking: string;
  kontak: string;
  alamat: string;
  hp: string;
  cs: string;
  adv: string;
  /** Benar bila kontak dan alamat sama-sama bersih dari tanda "*". */
  bolehSimpanCustomer: boolean;
}

export interface KesalahanBaris {
  row: number;
  reason: string;
}

export interface HasilUrai {
  /** Indeks baris header pada array masukan, -1 bila tidak ketemu. */
  barisHeader: number;
  baris: BarisTerurai[];
  errors: KesalahanBaris[];
  /** Header di sheet yang tidak ada di HEADER_MAP. */
  kolomTakDikenal: string[];
  /** Baris yang sengaja dilewati (kosong, kontak kosong, kode kosong). */
  dilewati: number;
}

const sel = (baris: unknown[], i: number): unknown =>
  i >= 0 && i < baris.length ? baris[i] : "";

const teks = (nilai: unknown): string =>
  nilai === null || nilai === undefined ? "" : String(nilai).trim();

/**
 * Cari baris header: kolom A-nya persis "Tanggal Proses".
 *
 * Sheet warisan sering punya beberapa baris judul atau logo di atas,
 * jadi header tidak bisa diasumsikan berada di baris pertama.
 */
export function cariBarisHeader(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const kolomA = normalizeHeader(sel(rows[i] ?? [], 0));
    if (HEADER_PENANDA.includes(kolomA)) return i;
  }
  return -1;
}

/** Header → indeks kolomnya. Header ganda: yang pertama menang. */
function petakanHeader(headerRow: unknown[]): {
  indeks: Map<string, number>;
  takDikenal: string[];
} {
  const indeks = new Map<string, number>();
  const takDikenal: string[] = [];

  headerRow.forEach((mentah, i) => {
    const nama = normalizeHeader(mentah);
    if (nama === "") return;

    const kolom = HEADER_MAP[nama];
    if (!kolom) {
      takDikenal.push(String(mentah).trim());
      return;
    }
    if (!indeks.has(kolom)) indeks.set(kolom, i);
  });

  return { indeks, takDikenal };
}

export function uraiSheet(rows: unknown[][]): HasilUrai {
  const barisHeader = cariBarisHeader(rows);
  if (barisHeader === -1) {
    return {
      barisHeader: -1,
      baris: [],
      errors: [
        {
          row: 0,
          reason:
            'Baris header tidak ditemukan — tidak ada baris yang kolom A-nya "Tanggal Proses".',
        },
      ],
      kolomTakDikenal: [],
      dilewati: 0,
    };
  }

  const { indeks, takDikenal } = petakanHeader(rows[barisHeader] ?? []);
  const baris: BarisTerurai[] = [];
  const errors: KesalahanBaris[] = [];
  let dilewati = 0;

  const ambil = (baris: unknown[], kolom: string): unknown => {
    const i = indeks.get(kolom);
    return i === undefined ? "" : sel(baris, i);
  };

  for (let i = barisHeader + 1; i < rows.length; i++) {
    const mentah = rows[i] ?? [];
    const nomorBaris = i + 1;

    if (mentah.every((v) => teks(v) === "")) {
      dilewati++;
      continue;
    }

    const kontak = teks(ambil(mentah, "contack"));
    if (kontak === "") {
      dilewati++;
      continue;
    }

    const kodeBooking = teks(ambil(mentah, "kode_booking"));
    if (kodeBooking === "") {
      dilewati++;
      continue;
    }

    const kolom: Record<string, string | null> = {};
    let gagalTanggal: string | null = null;

    for (const [namaKolom, posisi] of indeks) {
      const nilai = sel(mentah, posisi);

      if (KOLOM_TANGGAL.has(namaKolom)) {
        const tanggal = normalizeTanggal(nilai);
        if (tanggal === null) {
          gagalTanggal = `Kolom ${namaKolom} tidak terbaca sebagai tanggal: ${JSON.stringify(
            teks(nilai),
          )}`;
          break;
        }
        kolom[namaKolom] = tanggal;
        continue;
      }

      if (KOLOM_TIMESTAMP.has(namaKolom)) {
        /* Timestamp boleh kosong — kolomnya nullable, tidak seperti
           tanggal_proses yang jadi kunci semua filter rentang. */
        kolom[namaKolom] = normalizeTimestamp(nilai);
        continue;
      }

      kolom[namaKolom] = KOLOM_UANG.has(namaKolom)
        ? normalizeUang(nilai)
        : teks(nilai);
    }

    if (gagalTanggal) {
      errors.push({ row: nomorBaris, reason: gagalTanggal });
      continue;
    }

    const alamat = teks(ambil(mentah, "alamat"));
    const cs = normalizeNama(ambil(mentah, "cs"));
    const adv = normalizeNama(ambil(mentah, "adv"));

    baris.push({
      nomorBaris,
      kolom,
      kodeBooking,
      kontak,
      alamat,
      hp: normalizeHp(kontak),
      cs,
      adv,
      bolehSimpanCustomer: !tersensor(kontak) && !tersensor(alamat),
    });
  }

  return {
    barisHeader,
    baris,
    errors,
    kolomTakDikenal: takDikenal,
    dilewati,
  };
}
