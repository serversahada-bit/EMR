import "server-only";

import { query } from "./db";

/**
 * Marketplace — Shopee/Lazada & TikTok Shop.
 *
 * TIDAK memakai `katalog-spend` seperti Meta/Google/Snack, dan itu
 * disengaja. Dua alasannya:
 *
 *  1. Satu tanggal punya BANYAK baris (satu per toko) DITAMBAH baris
 *     agregat berlabel TOTAL. `katalog-spend` menjumlahkan semua baris
 *     per tanggal, jadi tokonya terhitung dua kali — sekali sendiri,
 *     sekali lewat agregatnya. Untuk 2026 itu menggelembungkan spend
 *     dari Rp1,88 M jadi Rp2,02 M. Karena itu setiap query di sini
 *     mewajibkan `agregat = 0`.
 *
 *  2. Nilai utama marketplace bukan spend melainkan OMSET, BOX, dan
 *     JUMLAH PESANAN — tiga kolom yang tidak ada di kanal iklan dan
 *     tidak dikembalikan `katalog-spend`.
 */

const PREFIX = "data_spend_mp";
/* Nama tabel tidak boleh datang dari URL; hanya dari katalog database. */
const POLA_TABEL = /^data_spend_mp[a-z0-9_]*$/;

export interface SumberMp {
  id: string;
  label: string;
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

/** Tabel marketplace yang benar-benar ada di database. */
export async function sumberMp(): Promise<SumberMp[]> {
  const baris = await query<{ table_name: string }>(
    `SELECT table_name AS table_name
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name LIKE ?
      ORDER BY table_name`,
    [`${PREFIX}\\_%`],
  );
  return baris
    .map((r) => r.table_name)
    .filter((t) => POLA_TABEL.test(t))
    .map((tabel) => ({
      id: tabel.replace(`${PREFIX}_`, "").replace(/_harian$/, ""),
      label: labelDari(tabel),
      tabel,
    }));
}

function gabung(tabel: string[], kolom: string): string {
  return tabel
    .map((t) => `SELECT ${kolom} FROM ${t} WHERE agregat = 0`)
    .join(" UNION ALL ");
}

/** Ringkasan per bulan, seluruh produk. */
export async function ringkasBulanMp(): Promise<RingkasBulanMp[]> {
  const sumber = await sumberMp();
  if (sumber.length === 0) return [];
  const inner = gabung(
    sumber.map((s) => s.tabel),
    "tanggal, total_spend, omset_total, box, jumlah_pesanan",
  );
  return query<RingkasBulanMp>(
    `SELECT DATE_FORMAT(tanggal, '%Y-%m') AS bulan,
            COALESCE(SUM(total_spend), 0)    AS spend,
            COALESCE(SUM(omset_total), 0)    AS omset,
            COALESCE(SUM(box), 0)            AS box,
            COALESCE(SUM(jumlah_pesanan), 0) AS pesanan
       FROM (${inner}) x
      GROUP BY bulan
      ORDER BY bulan`,
  );
}

/** Rincian harian satu bulan, dipecah per kanal dan blok (toko). */
export async function harianMp(bulan: string): Promise<BarisHarianMp[]> {
  const sumber = await sumberMp();
  if (sumber.length === 0) return [];
  const inner = gabung(
    sumber.map((s) => s.tabel),
    "tanggal, kanal, blok, total_spend, spend_iklan, omset_total, box, jumlah_pesanan",
  );
  return query<BarisHarianMp>(
    `SELECT DATE_FORMAT(tanggal, '%Y-%m-%d')  AS tanggal,
            kanal,
            COALESCE(NULLIF(blok, ''), '(tanpa label)') AS blok,
            COALESCE(SUM(total_spend), 0)    AS spend,
            COALESCE(SUM(spend_iklan), 0)    AS spendIklan,
            COALESCE(SUM(omset_total), 0)    AS omset,
            COALESCE(SUM(box), 0)            AS box,
            COALESCE(SUM(jumlah_pesanan), 0) AS pesanan
       FROM (${inner}) x
      WHERE DATE_FORMAT(tanggal, '%Y-%m') = ?
      GROUP BY tanggal, kanal, blok
      ORDER BY tanggal, kanal, blok`,
    [bulan],
  );
}

/** Per produk untuk satu bulan. */
export async function produkMp(
  bulan: string,
): Promise<{ produk: string; spend: number; omset: number; box: number }[]> {
  const sumber = await sumberMp();
  if (sumber.length === 0) return [];
  const inner = gabung(
    sumber.map((s) => s.tabel),
    "tanggal, produk, total_spend, omset_total, box",
  );
  return query(
    `SELECT produk,
            COALESCE(SUM(total_spend), 0) AS spend,
            COALESCE(SUM(omset_total), 0) AS omset,
            COALESCE(SUM(box), 0)         AS box
       FROM (${inner}) x
      WHERE DATE_FORMAT(tanggal, '%Y-%m') = ?
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
  const sumber = await sumberMp();
  if (sumber.length === 0) return { baris: 0, spend: 0, omset: 0 };
  const inner = sumber
    .map(
      (s) =>
        `SELECT tanggal, total_spend, omset_total FROM ${s.tabel} WHERE agregat = 1`,
    )
    .join(" UNION ALL ");
  const [row] = await query<{ baris: number; spend: number; omset: number }>(
    `SELECT COUNT(*) AS baris,
            COALESCE(SUM(total_spend), 0) AS spend,
            COALESCE(SUM(omset_total), 0) AS omset
       FROM (${inner}) x
      WHERE DATE_FORMAT(tanggal, '%Y-%m') = ?`,
    [bulan],
  );
  return row ?? { baris: 0, spend: 0, omset: 0 };
}

/* ---------- untuk halaman /marketplace/spend-iklan ----------
   Bentuknya mengikuti kanal lain (per produk, per bulan) supaya bisa
   memakai komponen SpendView yang sama. Bedanya tetap: `agregat = 0`
   diwajibkan, dan yang dikembalikan omset/box/pesanan. */

/** Bulan yang punya data untuk satu tabel MP. */
export async function mpBulanSumber(sourceId: string): Promise<string[]> {
  const sumber = await sumberMp();
  const s = sumber.find((x) => x.id === sourceId);
  if (!s) return [];
  const baris = await query<{ bulan: string }>(
    `SELECT DISTINCT DATE_FORMAT(tanggal, '%Y-%m') AS bulan
       FROM ${s.tabel}
      WHERE agregat = 0
      ORDER BY bulan DESC`,
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

/** Rincian harian satu tabel MP pada satu bulan. */
export async function mpHarianSumber(
  sourceId: string,
  bulan: string,
): Promise<HarianSumberMp[]> {
  const sumber = await sumberMp();
  const s = sumber.find((x) => x.id === sourceId);
  if (!s) return [];
  return query<HarianSumberMp>(
    `SELECT DATE_FORMAT(tanggal, '%Y-%m-%d')  AS tanggal,
            COALESCE(SUM(total_spend), 0)    AS spend,
            COALESCE(SUM(omset_total), 0)    AS omset,
            COALESCE(SUM(box), 0)            AS box,
            COALESCE(SUM(jumlah_pesanan), 0) AS pesanan,
            COUNT(*)                         AS baris
       FROM ${s.tabel}
      WHERE agregat = 0
        AND DATE_FORMAT(tanggal, '%Y-%m') = ?
      GROUP BY tanggal
      ORDER BY tanggal`,
    [bulan],
  );
}
