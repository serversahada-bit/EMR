import "server-only";

import { query } from "./db";

/* ──────────────────────────────────────────────────────────────
   Query omset dari database operasional (tabel data_transaksi).

   Rumus omset mengikuti laporan PHP yang sudah berjalan:
       total_harga + ongkir + fee − diskon

   PENTING soal kecepatan: filter bulan HARUS berupa rentang
   tanggal (tanggal_proses >= awal AND < bulan berikutnya), bukan
   DATE_FORMAT(tanggal_proses,'%Y-%m') = '...'. Membungkus kolom
   dalam fungsi membuat index `tanggal_proses` tidak terpakai,
   sehingga setiap query memindai seluruh 359 ribu baris. Pada
   mesin ini perbedaannya nyata: omset per ADV turun dari 9.408 ms
   menjadi 98 ms setelah ditulis sebagai rentang.

   Penyesuaian lain:

   1. Kolom uang bertipe VARCHAR. Penjumlahan implisit MySQL
      menghasilkan float, sehingga total bulanan bisa muncul
      sebagai 1491781049.6000001. Di sini di-CAST ke DECIMAL.
   2. Nilai kosong ("") di-COALESCE menjadi 0. Tanpa itu, satu
      kolom kosong membuat omset seluruh baris jadi NULL.
   3. Angka berformat Indonesia ("18.000,00") dibaca utuh — lihat
      `money()`. INI MEMBUAT EMR BEDA DARI LAPORAN PHP: 15 bulan
      historis naik, terbesar Februari 2025 (+3,07%) dan Juli 2025
      (+1,29%). Selisih itu disengaja; PHP memakai CAST polos dan
      kehilangan angkanya. Bulan berjalan tidak terpengaruh.

   LEFT JOIN tracking pada query PHP sengaja TIDAK dipakai:
   tracking_id terbukti unik, jadi join itu tidak memengaruhi
   hasil SUM sama sekali — hanya menambah beban.
   ────────────────────────────────────────────────────────────── */

/**
 * Satu kolom uang VARCHAR → DECIMAL yang aman dijumlahkan.
 *
 * Sebagian baris tersimpan berformat Indonesia ("18.000,00"). CAST
 * berhenti di karakter non-angka pertama, jadi nilai itu terbaca 18,00
 * — bukan 18.000. Diam-diam itu menghilangkan Rp 99,7 juta omset dari
 * 3.902 baris; Februari 2025 saja meleset 3,07%. Titik berkelompok tiga
 * karena itu dibersihkan dulu sebelum CAST.
 *
 * SENGAJA tidak disentuh: 122 baris bergaya "10,5" atau "16.5". Nilainya
 * tampak dalam ribuan (216000 + 10500 + 7000 − 17500 = cod_value 216000,
 * persis), tapi pada baris yang sama `fee` tertulis "7" — bilangan bulat
 * biasa yang tidak bisa dibedakan dari rupiah penuh. Unitnya tidak dapat
 * disimpulkan dari format, jadi menebak di sini akan merusak baris lain.
 */
function money(column: string): string {
  const ribuan = `${column} REGEXP '^-?[0-9]{1,3}([.][0-9]{3})+(,[0-9]+)?$'`;
  const bersih = `REPLACE(REPLACE(${column}, '.', ''), ',', '.')`;
  return `COALESCE(CASE
             WHEN ${ribuan} THEN CAST(${bersih} AS DECIMAL(20, 2))
             ELSE CAST(NULLIF(${column}, '') AS DECIMAL(20, 2))
           END, 0)`;
}

/** Satu kolom jumlah barang VARCHAR → DECIMAL. */
function qty(column: string): string {
  return `COALESCE(CAST(NULLIF(${column}, '') AS DECIMAL(20, 0)), 0)`;
}

/**
 * JANGAN bungkus `diskon` dengan ABS(). Sebagian baris memang berisi
 * diskon negatif (23 baris pada September 2026), sehingga nilainya
 * menambah omset, bukan mengurangi — itu terlihat seperti bug tapi
 * bukan. Diuji dengan mencocokkan cod_value, yaitu uang yang benar-benar
 * ditagih: dari baris COD yang bisa diuji, 0 dari 7 cocok bila diskon
 * di-ABS, sedangkan tanpa ABS cocok 4 dari 7 — setara baseline baris
 * diskon positif (62%). Jadi tanda minus itu biaya tambahan yang
 * disengaja, dan memasang ABS() justru menggeser omset ~Rp 194.000.
 */
export const OMSET = `(${money("total_harga")} + ${money("ongkir")} + ${money("fee")} - ${money("diskon")})`;
const BARANG = `(${qty("jumlah_1")} + ${qty("jumlah_2")} + ${qty("jumlah_3")})`;

/** "2026-09" → ["2026-09-01", "2026-10-01"] (batas atas eksklusif). */
export function batasBulan(bulan: string): [string, string] {
  const tahun = Number(bulan.slice(0, 4));
  const ke = Number(bulan.slice(5, 7));
  const awal = `${bulan}-01`;
  const akhir =
    ke === 12
      ? `${tahun + 1}-01-01`
      : `${tahun}-${String(ke + 1).padStart(2, "0")}-01`;
  return [awal, akhir];
}

/** Awal rentang untuk `jumlahBulan` bulan yang berakhir di `bulan`. */
function awalRentangBulan(bulan: string, jumlahBulan: number): string {
  const tahun = Number(bulan.slice(0, 4));
  const ke = Number(bulan.slice(5, 7));
  const totalBulan = tahun * 12 + (ke - 1) - (jumlahBulan - 1);
  const t = Math.floor(totalBulan / 12);
  const b = (totalBulan % 12) + 1;
  return `${t}-${String(b).padStart(2, "0")}-01`;
}

/**
 * Memo singkat untuk query yang berat tapi jarang berubah.
 * Angka bulan berjalan sengaja TIDAK di-cache agar tetap segar.
 */
const memo = new Map<string, { pada: number; nilai: unknown }>();

async function denganMemo<T>(
  kunci: string,
  ttlMs: number,
  ambil: () => Promise<T>,
): Promise<T> {
  const ada = memo.get(kunci);
  if (ada && Date.now() - ada.pada < ttlMs) return ada.nilai as T;

  const nilai = await ambil();
  memo.set(kunci, { pada: Date.now(), nilai });
  return nilai;
}

export interface OmsetHarian {
  /** "01" … "31" */
  hari: string;
  transaksi: number;
  barang: number;
  omset: number;
  harga: number;
  ongkir: number;
  fee: number;
  diskon: number;
}

export interface OmsetBulan {
  /** "2026-09" */
  bulan: string;
  transaksi: number;
  barang: number;
  omset: number;
}

export interface OmsetRingkas {
  transaksi: number;
  barang: number;
  omset: number;
  harga: number;
  ongkir: number;
  fee: number;
  diskon: number;
}

export interface OmsetPerAdv {
  adv: string;
  transaksi: number;
  omset: number;
}

export interface MutuData {
  /**
   * Baris yang nilai uangnya bukan angka (mis. kolom bergeser saat
   * impor sehingga total_harga berisi "DKI Jakarta"). MySQL
   * menghitungnya 0, dan transaksi yang ikut tertelan ke baris itu
   * tidak masuk sama sekali — jadi omset lebih rendah dari semestinya.
   *
   * Dipakai sebagai alarm, bukan catatan rutin: UI hanya menampilkannya
   * bila jumlahnya cukup untuk menggeser angka bulanan. Lihat
   * `imporRusakParah` di OmsetView.
   */
  barisUangTidakValid: number;
}

const num = (value: unknown): number => Number(value ?? 0);

/** Daftar bulan yang punya data, terbaru lebih dulu. */
export async function listBulan(): Promise<string[]> {
  return denganMemo("listBulan", 5 * 60_000, async () => {
    const rows = await query<{ bulan: string }>(
      `SELECT DISTINCT DATE_FORMAT(tanggal_proses, '%Y-%m') AS bulan
       FROM data_transaksi
       WHERE tanggal_proses > '1970-01-01'
       ORDER BY bulan DESC`,
    );
    return rows.map((row) => row.bulan);
  });
}

export async function omsetPerHari(bulan: string): Promise<OmsetHarian[]> {
  const [awal, akhir] = batasBulan(bulan);

  const rows = await query<Record<string, unknown>>(
    `SELECT DATE_FORMAT(tanggal_proses, '%d') AS hari,
            COUNT(*)        AS transaksi,
            SUM(${BARANG})  AS barang,
            SUM(${OMSET})   AS omset,
            SUM(${money("total_harga")}) AS harga,
            SUM(${money("ongkir")})      AS ongkir,
            SUM(${money("fee")})         AS fee,
            SUM(${money("diskon")})      AS diskon
     FROM data_transaksi
     WHERE tanggal_proses >= ? AND tanggal_proses < ?
     GROUP BY hari
     ORDER BY hari`,
    [awal, akhir],
  );

  return rows.map((row) => ({
    hari: String(row.hari),
    transaksi: num(row.transaksi),
    barang: num(row.barang),
    omset: num(row.omset),
    harga: num(row.harga),
    ongkir: num(row.ongkir),
    fee: num(row.fee),
    diskon: num(row.diskon),
  }));
}

export async function ringkasBulan(bulan: string): Promise<OmsetRingkas> {
  const [awal, akhir] = batasBulan(bulan);

  const rows = await query<Record<string, unknown>>(
    `SELECT COUNT(*)       AS transaksi,
            SUM(${BARANG}) AS barang,
            SUM(${OMSET})  AS omset,
            SUM(${money("total_harga")}) AS harga,
            SUM(${money("ongkir")})      AS ongkir,
            SUM(${money("fee")})         AS fee,
            SUM(${money("diskon")})      AS diskon
     FROM data_transaksi
     WHERE tanggal_proses >= ? AND tanggal_proses < ?`,
    [awal, akhir],
  );

  const row = rows[0] ?? {};
  return {
    transaksi: num(row.transaksi),
    barang: num(row.barang),
    omset: num(row.omset),
    harga: num(row.harga),
    ongkir: num(row.ongkir),
    fee: num(row.fee),
    diskon: num(row.diskon),
  };
}

/** Banyaknya bulan yang ditarik untuk tren; "semua" = sejak data ada. */
export type RentangBulan = 12 | 24 | "semua";

export function bacaRentang(nilai?: string): RentangBulan {
  if (nilai === "24") return 24;
  if (nilai === "semua") return "semua";
  return 12;
}

/** Omset bulanan sampai `bulan`, sebanyak `rentang` bulan terakhir. */
export async function omsetPerBulan(
  bulan: string,
  rentang: RentangBulan = 12,
): Promise<OmsetBulan[]> {
  /* "semua" tetap memakai rentang tanggal agar index terpakai —
     batas bawahnya sekadar tanggal sebelum data paling awal. */
  const awal =
    rentang === "semua" ? "1971-01-01" : awalRentangBulan(bulan, rentang);
  const [, akhir] = batasBulan(bulan);

  return denganMemo(`tren:${bulan}:${rentang}`, 60_000, async () => {
    const rows = await query<Record<string, unknown>>(
      `SELECT DATE_FORMAT(tanggal_proses, '%Y-%m') AS bulan,
              COUNT(*)       AS transaksi,
              SUM(${BARANG}) AS barang,
              SUM(${OMSET})  AS omset
       FROM data_transaksi
       WHERE tanggal_proses >= ? AND tanggal_proses < ?
       GROUP BY bulan
       ORDER BY bulan`,
      [awal, akhir],
    );

    return rows.map((row) => ({
      bulan: String(row.bulan),
      transaksi: num(row.transaksi),
      barang: num(row.barang),
      omset: num(row.omset),
    }));
  });
}

/**
 * Peringkat sumber omset. Kolom `adv` di data riil berisi campuran
 * kode advertiser (DHANI:MT) dan nama kanal (Shopee, TikTok), jadi
 * label di UI menyebutnya "ADV / kanal" apa adanya.
 */
export async function omsetPerAdv(
  bulan: string,
  batas = 10,
): Promise<OmsetPerAdv[]> {
  const [awal, akhir] = batasBulan(bulan);

  const rows = await query<Record<string, unknown>>(
    `SELECT COALESCE(NULLIF(TRIM(adv), ''), '(tidak diisi)') AS adv,
            COUNT(*)      AS transaksi,
            SUM(${OMSET}) AS omset
     FROM data_transaksi
     WHERE tanggal_proses >= ? AND tanggal_proses < ?
     GROUP BY adv
     ORDER BY omset DESC`,
    [awal, akhir],
  );

  const all = rows.map((row) => ({
    adv: String(row.adv),
    transaksi: num(row.transaksi),
    omset: num(row.omset),
  }));

  if (all.length <= batas) return all;

  /* Ekor dilipat jadi satu baris, bukan dibuang. */
  const head = all.slice(0, batas);
  const tail = all.slice(batas);
  head.push({
    adv: `Lainnya (${tail.length} sumber)`,
    transaksi: tail.reduce((acc, row) => acc + row.transaksi, 0),
    omset: tail.reduce((acc, row) => acc + row.omset, 0),
  });
  return head;
}

/** Customer baru pada bulan tersebut (tanggal registrasi). */
export async function customerBaru(bulan: string): Promise<number> {
  const [awal, akhir] = batasBulan(bulan);

  const rows = await query<{ jumlah: unknown }>(
    `SELECT COUNT(*) AS jumlah
     FROM data_customer
     WHERE tgl_reg >= ? AND tgl_reg < ?`,
    [awal, akhir],
  );
  return num(rows[0]?.jumlah);
}

/**
 * Hitung baris bermasalah supaya angkanya bisa dipercaya secara sadar.
 *
 * Polanya harus menerima persis apa yang `money()` sanggup baca, kalau
 * tidak alarmnya salah tuduh. Dua hal yang gampang terlewat:
 *
 * - Tanda minus (`^-?`). Versi pertama memakai `^[0-9]+` saja, sehingga
 *   nilai sah seperti "-7000" terhitung "bukan angka" dan banner
 *   melaporkan 24 baris rusak padahal yang rusak cuma 1.
 * - Format Indonesia ("18.000,00"). Sejak `money()` membacanya utuh,
 *   baris itu tidak lagi rusak; tanpa cabang kedua di bawah, Februari
 *   2025 tetap dilaporkan 1.725 baris rusak padahal tinggal 13.
 */
const POLA_ANGKA =
  "'^-?[0-9]+([.][0-9]+)?$|^-?[0-9]{1,3}([.][0-9]{3})+(,[0-9]+)?$'";

export async function mutuData(bulan: string): Promise<MutuData> {
  const [awal, akhir] = batasBulan(bulan);

  const kotor = await query<{ jumlah: unknown }>(
    `SELECT COUNT(*) AS jumlah
     FROM data_transaksi
     WHERE tanggal_proses >= ? AND tanggal_proses < ?
       AND (
            (total_harga <> '' AND total_harga NOT REGEXP ${POLA_ANGKA})
         OR (ongkir      <> '' AND ongkir      NOT REGEXP ${POLA_ANGKA})
         OR (fee         <> '' AND fee         NOT REGEXP ${POLA_ANGKA})
         OR (diskon      <> '' AND diskon      NOT REGEXP ${POLA_ANGKA})
       )`,
    [awal, akhir],
  );

  return { barisUangTidakValid: num(kotor[0]?.jumlah) };
}
