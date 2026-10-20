import "server-only";

import { query } from "./db";

/**
 * Marketplace — Shopee/Lazada & TikTok Shop.
 *
 * Sejak konsolidasi database (20 Okt 2026) semua marketplace ada di SATU
 * tabel `data_spend_mp`, dengan `produk` dan `tahun` sebagai kolom. Sebuah
 * "sumber" kini = nilai kolom `sumber_tabel` (nama tabel lama asal baris
 * itu), jadi id sumber tidak berubah dan dipilih lewat parameter `?`.
 *
 * TIDAK memakai `katalog-spend` seperti Meta/Google/Snack, dan itu
 * disengaja. Dua alasannya:
 *
 *  1. Satu tanggal punya BANYAK baris (satu per toko) DITAMBAH baris
 *     agregat berlabel TOTAL/REALISASI. `katalog-spend` menjumlahkan semua
 *     baris per tanggal, jadi tokonya terhitung dua kali — sekali sendiri,
 *     sekali lewat agregatnya. Karena itu setiap query di sini mewajibkan
 *     `agregat = 0`.
 *
 *  2. Nilai utama marketplace bukan spend melainkan OMSET, BOX, dan
 *     JUMLAH PESANAN — tiga kolom yang tidak ada di kanal iklan dan
 *     tidak dikembalikan `katalog-spend`.
 */

const TABEL = "data_spend_mp";
const PREFIX = "data_spend_mp";

export interface SumberMp {
  id: string;
  label: string;
  /** Nilai kolom `sumber_tabel` — kunci sumber di tabel gabungan. */
  tabel: string;
}

export interface RingkasBulanMp {
  bulan: string;
  spend: number;
  omset: number;
  box: number;
  pesanan: number;
}

export interface BarisHarianMp {
  tanggal: string;
  kanal: string;
  blok: string;
  spend: number;
  spendIklan: number;
  omset: number;
  box: number;
  pesanan: number;
}

function labelDari(tabel: string): string {
  const inti = tabel.replace(`${PREFIX}_`, "").replace(/_harian$/, "");
  const [produk, tahun] = [inti.replace(/_\d{4}$/, ""), inti.slice(-4)];
  const nama =
    produk === "utama"
      ? "Gamamilk"
      : produk === "gnait"
        ? "G'Nait"
        : produk.charAt(0).toUpperCase() + produk.slice(1);
  return `${nama} ${tahun}`;
}

/** Sumber marketplace yang punya baris di tabel gabungan. */
export async function sumberMp(): Promise<SumberMp[]> {
  const baris = await query<{ sumber: string }>(
    `SELECT DISTINCT sumber_tabel AS sumber FROM ${TABEL} ORDER BY sumber_tabel`,
  );
  return baris
    .map((r) => String(r.sumber))
    .map((tabel) => ({
      id: tabel.replace(`${PREFIX}_`, "").replace(/_harian$/, ""),
      label: labelDari(tabel),
      tabel,
    }));
}

/** Ringkasan per bulan, seluruh produk. */
export async function ringkasBulanMp(): Promise<RingkasBulanMp[]> {
  return query<RingkasBulanMp>(
    `SELECT DATE_FORMAT(tanggal, '%Y-%m') AS bulan,
            COALESCE(SUM(total_spend), 0)    AS spend,
            COALESCE(SUM(omset_total), 0)    AS omset,
            COALESCE(SUM(box), 0)            AS box,
            COALESCE(SUM(jumlah_pesanan), 0) AS pesanan
       FROM ${TABEL}
      WHERE agregat = 0
      GROUP BY DATE_FORMAT(tanggal, '%Y-%m')
      ORDER BY bulan`,
  );
}

/** Rincian harian satu bulan, dipecah per kanal dan blok (toko). */
export async function harianMp(bulan: string): Promise<BarisHarianMp[]> {
  return query<BarisHarianMp>(
    `SELECT DATE_FORMAT(tanggal, '%Y-%m-%d')  AS tanggal,
            kanal,
            COALESCE(NULLIF(blok, ''), '(tanpa label)') AS blok,
            COALESCE(SUM(total_spend), 0)    AS spend,
            COALESCE(SUM(spend_iklan), 0)    AS spendIklan,
            COALESCE(SUM(omset_total), 0)    AS omset,
            COALESCE(SUM(box), 0)            AS box,
            COALESCE(SUM(jumlah_pesanan), 0) AS pesanan
       FROM ${TABEL}
      WHERE agregat = 0 AND DATE_FORMAT(tanggal, '%Y-%m') = ?
      GROUP BY tanggal, kanal, COALESCE(NULLIF(blok, ''), '(tanpa label)')
      ORDER BY tanggal, kanal, blok`,
    [bulan],
  );
}

/** Per produk untuk satu bulan. */
export async function produkMp(
  bulan: string,
): Promise<{ produk: string; spend: number; omset: number; box: number }[]> {
  return query(
    `SELECT produk,
            COALESCE(SUM(total_spend), 0) AS spend,
            COALESCE(SUM(omset_total), 0) AS omset,
            COALESCE(SUM(box), 0)         AS box
       FROM ${TABEL}
      WHERE agregat = 0 AND DATE_FORMAT(tanggal, '%Y-%m') = ?
      GROUP BY produk
      ORDER BY omset DESC`,
    [bulan],
  );
}

/**
 * Berapa banyak yang disaring. Dipakai halaman untuk menerangkan
 * selisih kalau ada yang membandingkan dengan Excel.
 */
export async function agregatDisaring(
  bulan: string,
): Promise<{ baris: number; spend: number; omset: number }> {
  const [row] = await query<{ baris: number; spend: number; omset: number }>(
    `SELECT COUNT(*) AS baris,
            COALESCE(SUM(total_spend), 0) AS spend,
            COALESCE(SUM(omset_total), 0) AS omset
       FROM ${TABEL}
      WHERE agregat = 1 AND DATE_FORMAT(tanggal, '%Y-%m') = ?`,
    [bulan],
  );
  return row ?? { baris: 0, spend: 0, omset: 0 };
}

/* ---------- untuk halaman /marketplace/spend-iklan ----------
   Bentuknya mengikuti kanal lain (per produk, per bulan) supaya bisa
   memakai komponen SpendView yang sama. Bedanya tetap: `agregat = 0`
   diwajibkan, dan yang dikembalikan omset/box/pesanan. */

async function kunciSumber(sourceId: string): Promise<string | null> {
  const sumber = await sumberMp();
  return sumber.find((x) => x.id === sourceId)?.tabel ?? null;
}

/** Bulan yang punya data untuk satu sumber MP. */
export async function mpBulanSumber(sourceId: string): Promise<string[]> {
  const kunci = await kunciSumber(sourceId);
  if (!kunci) return [];
  const baris = await query<{ bulan: string }>(
    `SELECT DISTINCT DATE_FORMAT(tanggal, '%Y-%m') AS bulan
       FROM ${TABEL}
      WHERE agregat = 0 AND sumber_tabel = ?
      ORDER BY bulan DESC`,
    [kunci],
  );
  return baris.map((r) => r.bulan);
}

export interface HarianSumberMp {
  tanggal: string;
  spend: number;
  omset: number;
  box: number;
  pesanan: number;
  baris: number;
}

/** Rincian harian satu sumber MP pada satu bulan. */
export async function mpHarianSumber(
  sourceId: string,
  bulan: string,
): Promise<HarianSumberMp[]> {
  const kunci = await kunciSumber(sourceId);
  if (!kunci) return [];
  return query<HarianSumberMp>(
    `SELECT DATE_FORMAT(tanggal, '%Y-%m-%d')  AS tanggal,
            COALESCE(SUM(total_spend), 0)    AS spend,
            COALESCE(SUM(omset_total), 0)    AS omset,
            COALESCE(SUM(box), 0)            AS box,
            COALESCE(SUM(jumlah_pesanan), 0) AS pesanan,
            COUNT(*)                         AS baris
       FROM ${TABEL}
      WHERE agregat = 0 AND sumber_tabel = ?
        AND DATE_FORMAT(tanggal, '%Y-%m') = ?
      GROUP BY tanggal
      ORDER BY tanggal`,
    [kunci, bulan],
  );
}
