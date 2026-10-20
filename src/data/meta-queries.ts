import "server-only";

import { query } from "./db";

/**
 * Semua spend Meta ada di SATU tabel gabungan `data_spend_meta` (sejak
 * konsolidasi 20 Okt 2026). Sebuah sumber kini = nilai kolom
 * `sumber_tabel` (nama tabel lama asal baris itu), bukan tabel fisik —
 * id dan label di bawah tidak berubah, jadi pemetaan produk dan URL lama
 * tetap berlaku. `table` = nilai `sumber_tabel`.
 */
export const TABEL_META = "data_spend_meta";

export const META_SOURCES = [
  { id: "utama-2026", label: "Utama 2026", table: "data_spend_meta_harian" },
  { id: "premium-2026", label: "Premium 2026", table: "data_spend_meta_premium_harian" },
  { id: "utama-2025", label: "Utama 2025", table: "data_spend_meta_2025_harian" },
  { id: "premium-2025", label: "Premium 2025", table: "data_spend_meta_premium_2025_harian" },
  { id: "plus", label: "Plus", table: "data_spend_meta_plus_harian" },
  { id: "sereal", label: "Sereal", table: "data_spend_meta_sereal_harian" },
  { id: "utama-2024", label: "Utama 2024", table: "data_spend_meta_2024_harian" },
  { id: "gnait", label: "G'Nait", table: "data_spend_meta_gnait_harian" },
  { id: "phenobody", label: "Phenobody", table: "data_spend_meta_phenobody_harian" },
  { id: "etacefit", label: "Etacefit", table: "data_spend_meta_etacefit_harian" },
] as const;

export type MetaSourceId = (typeof META_SOURCES)[number]["id"];

/** Nilai `sumber_tabel` untuk sebuah id sumber; dipakai sebagai parameter `?`. */
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
     FROM ${TABEL_META}
     WHERE sumber_tabel = ?
       AND tanggal IS NOT NULL AND tanggal > '1970-01-01'
     ORDER BY bulan DESC`,
    [tabel],
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
     FROM ${TABEL_META}
     WHERE sumber_tabel = ? AND tanggal >= ? AND tanggal < ?
     GROUP BY tanggal
     ORDER BY tanggal`,
    [tabel, ...batasBulanIklan(bulan)],
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

/** Jumlah spend_iklan tanpa PPN per bulan per sumber — satu query. */
export async function metaSourceMonths(): Promise<MetaSourceMonth[]> {
  const idDari = new Map<string, string>(META_SOURCES.map((s) => [s.table, s.id]));
  const rows = await query<Record<string, unknown>>(
    `SELECT sumber_tabel AS sumber,
            DATE_FORMAT(tanggal, '%Y-%m') AS month,
            COUNT(*) AS records,
            COALESCE(SUM(spend_iklan), 0) AS spend,
            MAX(tanggal) AS lastDate
     FROM ${TABEL_META}
     WHERE tanggal IS NOT NULL AND tanggal > '1970-01-01'
     GROUP BY sumber_tabel, DATE_FORMAT(tanggal, '%Y-%m')
     ORDER BY month, sumber_tabel`,
  );

  return rows.filter((row) => idDari.has(String(row.sumber))).map((row) => ({
    sourceId: idDari.get(String(row.sumber))!,
    month: String(row.month),
    spend: Number(row.spend ?? 0),
    records: Number(row.records ?? 0),
    lastDate: String(row.lastDate),
  }));
}