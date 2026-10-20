import "server-only";

import { query } from "./db";

/**
 * Cost of Sales (COS) — dari sheet "COST OF SALES" tiap file Progres.
 *
 * COS = spend total ÷ omset total, dengan omset dijumlah lintas kanal
 * (Akuisisi + CRM + MP + TikTok). Inilah yang membuatnya berbeda dari
 * ROAS per kanal: closing dari iklan yang tercatat di CRM atau Shopee
 * tetap ikut dihitung.
 *
 * Dua tabel (semua tahun, kolom `tahun`):
 *  - `data_cos_harian`: satu baris per produk per hari. Hanya
 *    `jenis = 'DATA'` yang boleh dijumlah — `LEBIH HARI` adalah baris
 *    ke-31 di bulan 30 hari (tanggalnya NULL).
 *  - `data_cos_bulanan`: satu baris per produk per bulan, berisi
 *    KOREKSI yang dikurangkan pemilik sheet lewat rumus baris TOTAL
 *    (Kompensasi Snack + Pajak, angka ketik langsung). Koreksi itu tidak
 *    ada di baris harian mana pun, jadi angka "versi sheet" hanya bisa
 *    diambil dari tabel bulanan.
 *
 * Omset di sheet ini = box × harga tetap per kanal, BUKAN omset riil;
 * jangan dicocokkan dengan omset marketplace.
 */

export const TARGET_COS = 0.38;

/* Sejak konsolidasi 20 Okt 2026: satu tabel untuk semua tahun. Fungsi
   ini dipertahankan supaya query di bawah tetap berbentuk subquery yang
   sama; isinya kini konstanta, bukan hasil pencarian katalog. */
const TABEL_HARIAN = "data_cos_harian";
const TABEL_BULANAN = "data_cos_bulanan";

async function tabelCos(tabel: string): Promise<string[]> {
  return [tabel];
}

export interface CosBulan {
  /** YYYY-MM */
  bulan: string;
  produk: string;
  hari: number;
  spendHarian: number;
  omsetHarian: number;
  koreksi: number;
  spendSheet: number;
  omsetSheet: number;
  rumusKoreksi: string | null;
  labelBasi: number;
}

/** Semua baris bulanan, seluruh tahun yang ada. */
export async function cosBulanan(): Promise<CosBulan[]> {
  const tabel = await tabelCos(TABEL_BULANAN);
  if (tabel.length === 0) return [];
  const inner = tabel
    .map(
      (t) =>
        `SELECT tahun, bulan_no, produk, hari, spend_harian, omset_harian,
                koreksi_total, spend_sheet, omset_sheet, rumus_koreksi, label_basi
           FROM ${t}`,
    )
    .join(" UNION ALL ");
  const rows = await query<CosBulan>(
    `SELECT CONCAT(tahun, '-', LPAD(bulan_no, 2, '0')) AS bulan,
            produk,
            hari,
            COALESCE(spend_harian, 0)  AS spendHarian,
            COALESCE(omset_harian, 0)  AS omsetHarian,
            COALESCE(koreksi_total, 0) AS koreksi,
            COALESCE(spend_sheet, spend_harian, 0) AS spendSheet,
            COALESCE(omset_sheet, omset_harian, 0) AS omsetSheet,
            rumus_koreksi AS rumusKoreksi,
            label_basi    AS labelBasi
       FROM (${inner}) x
      ORDER BY bulan, produk`,
  );
  return rows.map((r) => ({
    ...r,
    hari: Number(r.hari),
    spendHarian: Number(r.spendHarian),
    omsetHarian: Number(r.omsetHarian),
    koreksi: Number(r.koreksi),
    spendSheet: Number(r.spendSheet),
    omsetSheet: Number(r.omsetSheet),
    labelBasi: Number(r.labelBasi),
  }));
}

export interface CosHari {
  tanggal: string;
  konversi: number;
  mbc: number;
  salesPromotion: number;
  lainLain: number;
  spend: number;
  omsetAkuisisi: number;
  omsetCrm: number;
  omsetMp: number;
  omsetTiktok: number;
  omset: number;
  box: number;
}

/**
 * Rincian harian satu bulan. `produk` null = semua produk dijumlah.
 * Hanya `jenis = 'DATA'`; koreksi bulanan tidak termasuk.
 */
export async function cosHarian(
  bulan: string,
  produk: string | null,
): Promise<CosHari[]> {
  const tabel = await tabelCos(TABEL_HARIAN);
  if (tabel.length === 0) return [];
  const inner = tabel
    .map(
      (t) =>
        `SELECT tanggal, produk, spend_konversi, spend_mbc, spend_sales_promotion,
                spend_lain_lain, spend_total, omset_akuisisi, omset_crm, omset_mp,
                omset_tiktok, omset_total, box_total
           FROM ${t} WHERE jenis = 'DATA'`,
    )
    .join(" UNION ALL ");
  const params: string[] = [bulan];
  if (produk) params.push(produk);
  const rows = await query<CosHari>(
    `SELECT DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal,
            COALESCE(SUM(spend_konversi), 0)        AS konversi,
            COALESCE(SUM(spend_mbc), 0)             AS mbc,
            COALESCE(SUM(spend_sales_promotion), 0) AS salesPromotion,
            COALESCE(SUM(spend_lain_lain), 0)       AS lainLain,
            COALESCE(SUM(spend_total), 0)           AS spend,
            COALESCE(SUM(omset_akuisisi), 0)        AS omsetAkuisisi,
            COALESCE(SUM(omset_crm), 0)             AS omsetCrm,
            COALESCE(SUM(omset_mp), 0)              AS omsetMp,
            COALESCE(SUM(omset_tiktok), 0)          AS omsetTiktok,
            COALESCE(SUM(omset_total), 0)           AS omset,
            COALESCE(SUM(box_total), 0)             AS box
       FROM (${inner}) x
      WHERE DATE_FORMAT(tanggal, '%Y-%m') = ?
        ${produk ? "AND produk = ?" : ""}
      GROUP BY tanggal
      ORDER BY tanggal`,
    params,
  );
  return rows.map((r) => {
    const o = { ...r } as Record<string, number | string>;
    for (const k of Object.keys(o)) if (k !== "tanggal") o[k] = Number(o[k]);
    return o as unknown as CosHari;
  });
}
