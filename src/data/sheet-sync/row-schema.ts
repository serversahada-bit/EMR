/* ──────────────────────────────────────────────────────────────
   Validasi baris sebelum menyentuh database.

   Baris yang gagal dikumpulkan dan dilaporkan, tidak menghentikan
   sisa proses — sheet 3.000 baris tidak boleh batal total gara-gara
   satu sel berantakan.
   ────────────────────────────────────────────────────────────── */

import { z } from "zod";

import { KOLOM_OMSET, KOLOM_UANG } from "./header-map";
import type { BarisTerurai } from "./parse-sheet";

/**
 * Lebar VARCHAR sebenarnya di data_transaksi.
 *
 * Diperiksa di sini supaya nilai kepanjangan ditolak dengan alasan
 * yang jelas. Tanpa ini MySQL memotongnya diam-diam (atau menolak
 * seluruh batch dalam mode strict, yang menjatuhkan 499 baris sehat
 * bersama satu baris bermasalah).
 */
export const LEBAR_KOLOM: Record<string, number> = {
  kode_booking: 30,
  resi: 100,
  barang: 30,
  jumlah: 50,
  harga: 20,
  bonus: 100,
  total_harga: 20,
  contack: 20,
  kota: 100,
  kecamatan: 100,
  provinsi: 100,
  hadiah: 100,
  isi_paket: 500,
  cod_value: 50,
  keterangan: 100,
  ekspedisi: 40,
  tipe_pembayaran: 60,
  usia_customer: 150,
  gudang: 60,
  cs: 60,
  adv: 60,
  ongkir: 60,
  fee: 60,
  diskon: 60,
  ro: 200,
  barang_1: 100,
  jumlah_1: 100,
  harga_1: 100,
  barang_2: 100,
  jumlah_2: 100,
  harga_2: 100,
  barang_3: 100,
  jumlah_3: 100,
  harga_3: 100,
  barang_4: 100,
  jumlah_4: 100,
  harga_4: 100,
  barang_5: 100,
  jumlah_5: 100,
  harga_5: 100,
};

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const POLA_WAKTU = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const POLA_ANGKA = /^-?\d+(\.\d+)?$/;

const Inti = z.object({
  kode_booking: z
    .string()
    .min(1, "Unique Code kosong")
    .max(30, "Unique Code lebih dari 30 karakter"),
  contack: z
    .string()
    .min(1, "CONTACT kosong")
    .max(20, "CONTACT lebih dari 20 karakter"),
  tanggal_proses: z
    .string()
    .regex(POLA_TANGGAL, "Tanggal Proses bukan format yyyy-mm-dd"),
  time_stamp: z
    .string()
    .regex(POLA_WAKTU, "Timestamp bukan format yyyy-mm-dd HH:mm:ss")
    .nullable(),
});

export interface HasilValidasi {
  /** Terisi berarti baris ditolak. */
  fatal: string[];
  /** Nilai yang dibersihkan supaya baris tetap bisa disimpan. */
  perbaikan: string[];
}

/**
 * Periksa satu baris, perbaiki yang bisa diperbaiki.
 *
 * Membedakan dua jenis masalah, dan itu disengaja: nilai rusak pada
 * kolom yang ikut rumus omset membatalkan barisnya, sedangkan kerusakan
 * di kolom lain cukup dibersihkan. Versi pertama menolak semuanya, dan
 * pada sheet September 2026 itu membuang 15 transaksi senilai Rp 3,7 juta
 * hanya karena `harga_4` berisi "30/12/1899" — tanggal Excel yang tidak
 * memengaruhi omset sama sekali.
 *
 * Perbaikan dilakukan langsung pada `baris.kolom`, jadi pemanggil cukup
 * menyimpan baris itu apa adanya setelah fungsi ini.
 */
export function validasiBaris(baris: BarisTerurai): HasilValidasi {
  const fatal: string[] = [];
  const perbaikan: string[] = [];

  const inti = Inti.safeParse({
    kode_booking: baris.kodeBooking,
    contack: baris.kontak,
    tanggal_proses: baris.kolom.tanggal_proses ?? "",
    time_stamp: baris.kolom.time_stamp ?? null,
  });

  if (!inti.success) {
    for (const masalah of inti.error.issues) fatal.push(masalah.message);
  }

  for (const [kolom, nilai] of Object.entries(baris.kolom)) {
    if (nilai === null) continue;

    if (KOLOM_UANG.has(kolom) && nilai !== "" && !POLA_ANGKA.test(nilai)) {
      if (KOLOM_OMSET.has(kolom)) {
        fatal.push(`${kolom} bukan angka: ${JSON.stringify(nilai)}`);
        continue;
      }
      baris.kolom[kolom] = "";
      perbaikan.push(`${kolom} dikosongkan (bukan angka: ${nilai})`);
      continue;
    }

    const lebar = LEBAR_KOLOM[kolom];
    if (lebar !== undefined && nilai.length > lebar) {
      if (KOLOM_OMSET.has(kolom)) {
        fatal.push(`${kolom} lebih dari ${lebar} karakter (${nilai.length})`);
        continue;
      }
      /* Dipotong di sini, bukan dibiarkan MySQL memotongnya diam-diam —
         sql_mode server ini tidak STRICT. */
      baris.kolom[kolom] = nilai.slice(0, lebar);
      perbaikan.push(`${kolom} dipotong ke ${lebar} karakter`);
    }
  }

  return { fatal, perbaikan };
}

/** Masukan server action. */
export const SyncInput = z.object({
  sheetUrl: z.string().min(1, "URL spreadsheet wajib diisi"),
  tabName: z.string().min(1, "Nama tab wajib diisi"),
  operator: z.string().min(1, "Nama operator wajib diisi").max(500),
});

export type SyncInput = z.infer<typeof SyncInput>;
