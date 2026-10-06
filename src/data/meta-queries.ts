import "server-only";

import { query } from "./db";

/** Setiap tabel adalah sumber tersendiri; nama tabel tetap dan tidak berasal dari URL. */
export const META_SOURCES = [
  { id: "utama-2026", label: "Utama 2026", table: "data_spend_meta_harian" },
  { id: "premium-2026", label: "Premium 2026", table: "data_spend_meta_premium_harian" },
  { id: "utama-2025", label: "Utama 2025", table: "data_spend_meta_2025_harian" },
  { id: "premium-2025", label: "Premium 2025", table: "data_spend_meta_premium_2025_harian" },
  { id: "plus", label: "Plus", table: "data_spend_meta_plus_harian" },
  { id: "sereal", label: "Sereal", table: "data_spend_meta_sereal_harian" },
  { id: "utama-2024", label: "Utama 2024", table: "data_spend_meta_2024_harian" },
] as const;

export type MetaSourceId = (typeof META_SOURCES)[number]["id"];

/**
 * Nama tabel untuk sebuah id sumber.
 *
 * Dicari lewat daftar tetap di atas, bukan disusun dari masukan: nama
 * tabel tidak bisa diparameterkan di SQL, jadi satu-satunya cara aman
 * adalah memastikan nilainya berasal dari konstanta kita sendiri.
 */
function tabelSumber(sourceId: string): string | null {
  return META_SOURCES.find((s) => s.id === sourceId)?.table ?? null;
}

export interface SpendHarian {
  /** "2026-10-01" */
  tanggal: string;
  spend: number;
  klik: number;
  lead: number;
  /** Baris mentah yang dijumlahkan — >1 berarti beberapa akun iklan. */
  baris: number;
}

/** Bulan yang punya data pada satu sumber, terbaru lebih dulu. */
export async function metaBulanSumber(sourceId: string): Promise<string[]> {
  const tabel = tabelSumber(sourceId);
  if (!tabel) return [];

  const rows = await query<{ bulan: string }>(
    `SELECT DISTINCT DATE_FORMAT(tanggal, '%Y-%m') AS bulan
     FROM \`${tabel}\`
     WHERE tanggal IS NOT NULL AND tanggal > '1970-01-01'
     ORDER BY bulan DESC`,
  );
  return rows.map((r) => r.bulan);
}

/**
 * Spend harian satu sumber untuk satu bulan.
 *
 * Dijumlahkan per tanggal karena sebagian tabel memuat beberapa baris
 * untuk hari yang sama (satu per akun iklan); tanpa agregasi, tabelnya
 * menampilkan tanggal berulang tanpa penjelasan.
 */
export async function metaSpendHarian(
  sourceId: string,
  bulan: string,
): Promise<SpendHarian[]> {
  const tabel = tabelSumber(sourceId);
  if (!tabel) return [];

  const rows = await query<Record<string, unknown>>(
    `SELECT tanggal,
            COALESCE(SUM(spend_iklan), 0)     AS spend,
            COALESCE(SUM(klik_tautan), 0)     AS klik,
            COALESCE(SUM(total_lead_real), 0) AS lead_real,
            COUNT(*)                          AS baris
     FROM \`${tabel}\`
     WHERE tanggal >= ? AND tanggal < ?
     GROUP BY tanggal
     ORDER BY tanggal`,
    batasBulanIklan(bulan),
  );

  return rows.map((row) => ({
    tanggal: String(row.tanggal),
    spend: Number(row.spend ?? 0),
    klik: Number(row.klik ?? 0),
    lead: Number(row.lead_real ?? 0),
    baris: Number(row.baris ?? 0),
  }));
}

/** "2026-10" → ["2026-10-01", "2026-11-01"] (batas atas eksklusif). */
function batasBulanIklan(bulan: string): [string, string] {
  const tahun = Number(bulan.slice(0, 4));
  const ke = Number(bulan.slice(5, 7));
  const akhir =
    ke === 12
      ? `${tahun + 1}-01-01`
      : `${tahun}-${String(ke + 1).padStart(2, "0")}-01`;
  return [`${bulan}-01`, akhir];
}

export interface MetaSourceMonth {
  sourceId: string;
  month: string;
  spend: number;
  records: number;
  lastDate: string;
}

/** Jumlah spend_iklan tanpa PPN per bulan dari ketujuh tabel harian. */
export async function metaSourceMonths(): Promise<MetaSourceMonth[]> {
  const selects = META_SOURCES.map(
    (source) =>
      `SELECT '${source.id}' AS sourceId,
              DATE_FORMAT(tanggal, '%Y-%m') AS month,
              COUNT(*) AS records,
              COALESCE(SUM(spend_iklan), 0) AS spend,
              MAX(tanggal) AS lastDate
       FROM \`${source.table}\`
       WHERE tanggal IS NOT NULL AND tanggal > '1970-01-01'
       GROUP BY DATE_FORMAT(tanggal, '%Y-%m')`,
  );

  const rows = await query<Record<string, unknown>>(
    selects.join(" UNION ALL ") + " ORDER BY month, sourceId",
  );

  return rows.map((row) => ({
    sourceId: String(row.sourceId),
    month: String(row.month),
    spend: Number(row.spend ?? 0),
    records: Number(row.records ?? 0),
    lastDate: String(row.lastDate),
  }));
}