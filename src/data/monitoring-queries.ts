import "server-only";

import { query } from "./db";

/**
 * Marketing report per kanal — dari spreadsheet "Januari-Desember
 * Marketing Report Sahada <tahun>", tab "<BULAN> -<tahun> GENERAL
 * MONITORING" (lihat impor_monitoring.py). Tabel `data_monitoring_kanal`:
 * satu baris per bulan x produk x kanal, plus kanal TOTAL (agregat = 1)
 * yang membawa omset NETO sheet dan target/KPI.
 *
 * Yang disimpan hanya angka dasar (alokasi, realisasi spend, box, closing,
 * omset). Rasio — % alokasi, upsell, COS, kontribusi, ROAS — dihitung ulang
 * di halaman dengan rumus yang sama seperti di sheet, supaya tidak ikut
 * membawa sel #DIV/0!.
 *
 * Omset TOTAL di sheet = jumlah omset kanal DIKURANGI input manual per
 * pekan (kolom bantu AD10, kemungkinan retur). Karena itu TOTAL diambil
 * dari baris agregat, bukan dijumlah ulang dari kanal.
 */

export interface BarisMonitoring {
  produk: string;
  kanal: string;
  grup: string;
  agregat: number;
  alokasi: number | null;
  spend: number | null;
  box: number | null;
  closing: number | null;
  omset: number | null;
  targetBox: number | null;
  targetCos: number | null;
  targetCosEcom: number | null;
  targetCosSoscom: number | null;
}

export const URUT_KANAL = ["META x SHOPEE", "TIKTOK", "MP", "META", "SNACK", "CRM", "MARKOM", "TOTAL"];
/** Blok gabungan di sheet; angkanya SENDIRI, bukan jumlah blok produk. */
export const ALL_BRAND = "ALL BRAND";

export const URUT_PRODUK = [
  "Gamamilk",
  "Gamamilk Premium",
  "Gamamilk Plus",
  "Gamamilk Sereal",
  "Phenobody",
  "G'Nait",
  "Etacefit",
];

const angka = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Bulan yang tersedia, "YYYY-MM", terbaru dulu. */
export async function bulanMonitoring(): Promise<string[]> {
  const rows = await query<{ b: string }>(
    `SELECT DISTINCT CONCAT(tahun, '-', LPAD(bulan_no, 2, '0')) AS b
       FROM data_monitoring_kanal ORDER BY b DESC`,
  ).catch(() => []);
  return rows.map((r) => String(r.b));
}

/** Semua baris satu bulan. */
export async function dataMonitoring(bulan: string): Promise<BarisMonitoring[]> {
  const [th, bl] = bulan.split("-").map(Number);
  const rows = await query<Record<string, unknown>>(
    `SELECT produk, kanal, grup, agregat, alokasi, realisasi_spend, box, closing, omset,
            target_box, target_cos, target_cos_ecom, target_cos_soscom
       FROM data_monitoring_kanal WHERE tahun = ? AND bulan_no = ?`,
    [th, bl],
  );
  return rows.map((r) => ({
    produk: String(r.produk),
    kanal: String(r.kanal),
    grup: String(r.grup),
    agregat: Number(r.agregat),
    alokasi: angka(r.alokasi),
    spend: angka(r.realisasi_spend),
    box: angka(r.box),
    closing: angka(r.closing),
    omset: angka(r.omset),
    targetBox: angka(r.target_box),
    targetCos: angka(r.target_cos),
    targetCosEcom: angka(r.target_cos_ecom),
    targetCosSoscom: angka(r.target_cos_soscom),
  }));
}

/** Ringkasan per bulan dari blok ALL BRAND sheet: omset neto, spend, box, target box. */
export async function trenMonitoring(): Promise<
  { bulan: string; omset: number; spend: number; box: number; targetBox: number }[]
> {
  const rows = await query<Record<string, unknown>>(
    `SELECT CONCAT(tahun, '-', LPAD(bulan_no, 2, '0')) AS b,
            COALESCE(SUM(omset), 0) AS omset, COALESCE(SUM(realisasi_spend), 0) AS spend,
            COALESCE(SUM(box), 0) AS box, COALESCE(SUM(target_box), 0) AS target_box
       FROM data_monitoring_kanal WHERE agregat = 1 AND produk = 'ALL BRAND'
      GROUP BY tahun, bulan_no ORDER BY tahun, bulan_no`,
  ).catch(() => []);
  return rows.map((r) => ({
    bulan: String(r.b),
    omset: Number(r.omset),
    spend: Number(r.spend),
    box: Number(r.box),
    targetBox: Number(r.target_box),
  }));
}
