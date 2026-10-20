import "server-only";

import { query } from "./db";

/**
 * Kanal iklan yang tersimpan di SATU tabel gabungan per kanal.
 *
 * Dipakai bersama oleh Google Ads dan Snack Video. Sejak konsolidasi
 * database (20 Okt 2026) tiap kanal punya satu tabel — `data_spend_google`,
 * `data_spend_snack` — dengan `produk` dan `tahun` sebagai kolom, bukan
 * puluhan tabel `data_spend_<kanal>_<produk>_<tahun>_harian`.
 *
 * "Sumber" tetap dipertahankan sebagai satuan di halaman, tetapi kini
 * berupa nilai kolom `sumber_tabel` (nama tabel lama tempat baris itu
 * berasal), bukan tabel fisik. Dengan begitu id sumber tidak berubah —
 * pemetaan di Setingan produk, kartu produk, dan URL tetap berlaku.
 *
 * Nama tabel kini konstanta di kode dan sumber dipilih lewat parameter
 * `?`, jadi tidak ada lagi nama tabel yang disusun dari data. Katalog
 * `information_schema` hanya dibaca untuk daftar kolom.
 */

export interface KanalSpend {
  /** Tabel gabungan kanal ini, mis. "data_spend_google". */
  tabel: string;
  /**
   * Tahun yang ditampilkan. Kosongkan untuk menampilkan semua.
   * Baris tahun lain tetap ada di database — hanya disembunyikan.
   */
  tahunAktif: number[];
}

export interface SumberKanal {
  id: string;
  label: string;
  /** Nilai kolom `sumber_tabel` — kunci sumber di tabel gabungan. */
  table: string;
  produk: string;
  tahun: number;
}

/** "data_spend_google_premium_2025_harian" → "Premium 2025" */
function labelDariSumber(prefix: string, sumber: string): string {
  const sisa = sumber
    .replace(new RegExp(`^${prefix}_?`), "")
    .replace(/_?harian$/, "");
  if (!sisa) return "Utama";
  return sisa
    .split("_")
    .map((kata) =>
      /^\d+$/.test(kata) ? kata : kata.charAt(0).toUpperCase() + kata.slice(1),
    )
    .join(" ");
}

/** Sumber yang benar-benar punya baris di tabel kanal ini. */
export async function sumberKanal(kanal: KanalSpend): Promise<SumberKanal[]> {
  const rows = await query<{ sumber: string; produk: string; tahun: number }>(
    `SELECT sumber_tabel AS sumber, MIN(produk) AS produk, MIN(tahun) AS tahun
     FROM \`${kanal.tabel}\`
     GROUP BY sumber_tabel
     ORDER BY sumber_tabel`,
  );

  return rows
    .filter(
      (r) =>
        kanal.tahunAktif.length === 0 ||
        kanal.tahunAktif.includes(Number(r.tahun)),
    )
    .map((r) => ({
      id: String(r.sumber).replace(new RegExp(`^${kanal.tabel}_?`), "") || "utama",
      label: labelDariSumber(kanal.tabel, String(r.sumber)),
      table: String(r.sumber),
      produk: String(r.produk),
      tahun: Number(r.tahun),
    }));
}

/** Dipertahankan untuk pemanggil lama; semua sumber kini satu skema. */
export function sumberTerpakai(kanal: KanalSpend): Promise<SumberKanal[]> {
  return sumberKanal(kanal);
}

/** Nama kolom tabel gabungan (klik & lead tidak sama namanya antar kanal). */
async function kolomTabel(tabel: string): Promise<Set<string>> {
  /* Alias WAJIB: MySQL 8 mengembalikan kolom information_schema dalam
     huruf besar (COLUMN_NAME), MariaDB huruf kecil. */
  const rows = await query<{ column_name: string }>(
    `SELECT column_name AS column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tabel],
  );
  return new Set(rows.map((r) => String(r.column_name)));
}

export interface BulanSumber {
  sourceId: string;
  month: string;
  spend: number;
  records: number;
  lastDate: string;
}

/** Jumlah spend_iklan per bulan per sumber — satu query, tanpa UNION. */
export async function bulanSumberKanal(kanal: KanalSpend): Promise<{
  sources: SumberKanal[];
  months: BulanSumber[];
}> {
  const sources = await sumberKanal(kanal);
  if (sources.length === 0) return { sources: [], months: [] };
  const perSumber = new Map(sources.map((s) => [s.table, s.id]));

  const rows = await query<Record<string, unknown>>(
    `SELECT sumber_tabel AS sumber,
            DATE_FORMAT(tanggal, '%Y-%m') AS month,
            COUNT(*) AS records,
            COALESCE(SUM(spend_iklan), 0) AS spend,
            MAX(tanggal) AS lastDate
     FROM \`${kanal.tabel}\`
     WHERE tanggal IS NOT NULL AND tanggal > '1970-01-01'
     GROUP BY sumber_tabel, DATE_FORMAT(tanggal, '%Y-%m')
     ORDER BY month, sumber_tabel`,
  );

  return {
    sources,
    months: rows
      .filter((row) => perSumber.has(String(row.sumber)))
      .map((row) => ({
        sourceId: perSumber.get(String(row.sumber))!,
        month: String(row.month),
        spend: Number(row.spend ?? 0),
        records: Number(row.records ?? 0),
        lastDate: String(row.lastDate),
      })),
  };
}

/** Nilai `sumber_tabel` untuk sebuah id sumber, atau null bila tak dikenal. */
async function kunciSumber(
  kanal: KanalSpend,
  sourceId: string,
): Promise<string | null> {
  const sources = await sumberKanal(kanal);
  return sources.find((s) => s.id === sourceId)?.table ?? null;
}

/** Bulan yang punya data pada satu sumber, terbaru lebih dulu. */
export async function bulanSatuSumber(
  kanal: KanalSpend,
  sourceId: string,
): Promise<string[]> {
  const sumber = await kunciSumber(kanal, sourceId);
  if (!sumber) return [];

  const rows = await query<{ bulan: string }>(
    `SELECT DISTINCT DATE_FORMAT(tanggal, '%Y-%m') AS bulan
     FROM \`${kanal.tabel}\`
     WHERE sumber_tabel = ?
       AND tanggal IS NOT NULL AND tanggal > '1970-01-01'
     ORDER BY bulan DESC`,
    [sumber],
  );
  return rows.map((r) => r.bulan);
}

export interface SpendHarianKanal {
  /** "2026-10-01" */
  tanggal: string;
  spend: number;
  klik: number;
  lead: number;
  /** Baris mentah yang dijumlahkan — >1 berarti beberapa akun iklan. */
  baris: number;
}

/** "2026-10" → ["2026-10-01", "2026-11-01"] (batas atas eksklusif). */
export function batasBulan(bulan: string): [string, string] {
  const tahun = Number(bulan.slice(0, 4));
  const ke = Number(bulan.slice(5, 7));
  const akhir =
    ke === 12
      ? `${tahun + 1}-01-01`
      : `${tahun}-${String(ke + 1).padStart(2, "0")}-01`;
  return [`${bulan}-01`, akhir];
}

/**
 * Spend harian satu sumber untuk satu bulan.
 *
 * Dijumlahkan per tanggal karena satu sumber bisa memuat beberapa baris
 * untuk hari yang sama (satu per akun iklan). Klik dan lead dipilih dari
 * kolom yang tersedia: Google memecah klik jadi GSN dan non-GSN.
 */
export async function spendHarianKanal(
  kanal: KanalSpend,
  sourceId: string,
  bulan: string,
): Promise<SpendHarianKanal[]> {
  const sumber = await kunciSumber(kanal, sourceId);
  if (!sumber) return [];

  const ada = await kolomTabel(kanal.tabel);
  const kolomKlik = [
    "klik_tautan",
    "klik_tautan_non_gsn",
    "klik_tautan_gsn",
  ].filter((k) => ada.has(k));
  const klik = kolomKlik.length
    ? kolomKlik.map((k) => `COALESCE(SUM(${k}), 0)`).join(" + ")
    : "NULL";
  const lead = ada.has("total_lead_real")
    ? "SUM(total_lead_real)"
    : ada.has("total_lead_dashboard")
      ? "SUM(total_lead_dashboard)"
      : "NULL";

  const [awal, akhir] = batasBulan(bulan);
  const rows = await query<Record<string, unknown>>(
    `SELECT tanggal,
            COALESCE(SUM(spend_iklan), 0) AS spend,
            COALESCE(${klik}, 0)          AS klik,
            COALESCE(${lead}, 0)          AS lead_real,
            COUNT(*)                      AS baris
     FROM \`${kanal.tabel}\`
     WHERE sumber_tabel = ? AND tanggal >= ? AND tanggal < ?
     GROUP BY tanggal
     ORDER BY tanggal`,
    [sumber, awal, akhir],
  );

  return rows.map((row) => ({
    tanggal: String(row.tanggal),
    spend: Number(row.spend ?? 0),
    klik: Number(row.klik ?? 0),
    lead: Number(row.lead_real ?? 0),
    baris: Number(row.baris ?? 0),
  }));
}
