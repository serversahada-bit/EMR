import "server-only";

import { query } from "./db";
import { BARANG, OMSET, batasBulan, batasHari, listBulan, money, qty } from "./omset-queries";

/* ──────────────────────────────────────────────────────────────
   Sub-dashboard analitik: Penjualan, Produk, Wilayah.

   Semua dari data_transaksi dengan rumus OMSET yang SAMA dengan
   dashboard dan halaman Omset, jadi totalnya selalu cocok. Rentang
   memakai tanggal_proses; `sampaiHari` memotong bulan untuk pembanding
   setara (1–N bulan ini lawan 1–N bulan lalu), sama seperti halaman Omset.
   ────────────────────────────────────────────────────────────── */

const num = (v: unknown) => Number(v ?? 0);

function rentang(bulan: string, sampaiHari?: number): [string, string] {
  const [awal, akhirBulan] = batasBulan(bulan);
  return [awal, sampaiHari ? batasHari(bulan, sampaiHari) : akhirBulan];
}

/* ── PENJUALAN ──────────────────────────────────────────────── */

export interface RingkasPenjualan {
  omset: number;
  transaksi: number;
  box: number;
  /** Nomor HP unik — pendekatan jumlah pembeli. */
  pembeli: number;
  omsetCod: number;
  transaksiCod: number;
  hariTerakhir: string | null;
}

export async function ringkasPenjualan(bulan: string, sampaiHari?: number): Promise<RingkasPenjualan> {
  const [awal, akhir] = rentang(bulan, sampaiHari);
  const [r] = await query<Record<string, unknown>>(
    `SELECT COUNT(*) AS transaksi, SUM(${OMSET}) AS omset, SUM(${BARANG}) AS box,
            COUNT(DISTINCT NULLIF(TRIM(contack), '')) AS pembeli,
            SUM(CASE WHEN LOWER(TRIM(tipe_pembayaran)) = 'cod' THEN ${OMSET} ELSE 0 END) AS omset_cod,
            SUM(LOWER(TRIM(tipe_pembayaran)) = 'cod') AS transaksi_cod,
            MAX(tanggal_proses) AS hari_akhir
       FROM data_transaksi
      WHERE tanggal_proses >= ? AND tanggal_proses < ?`,
    [awal, akhir],
  );
  return {
    omset: num(r?.omset),
    transaksi: num(r?.transaksi),
    box: num(r?.box),
    pembeli: num(r?.pembeli),
    omsetCod: num(r?.omset_cod),
    transaksiCod: num(r?.transaksi_cod),
    hariTerakhir: r?.hari_akhir ? String(r.hari_akhir).slice(0, 10) : null,
  };
}

export interface BarisMetode {
  metode: string;
  transaksi: number;
  omset: number;
}

/** Metode bayar. Nilai mentah: cod, Prepaid, bank_transfer. */
export async function metodeBayar(bulan: string): Promise<BarisMetode[]> {
  const [awal, akhir] = rentang(bulan);
  const rows = await query<Record<string, unknown>>(
    `SELECT CASE LOWER(TRIM(tipe_pembayaran))
              WHEN 'cod' THEN 'COD'
              WHEN 'prepaid' THEN 'Prepaid (marketplace)'
              WHEN 'bank_transfer' THEN 'Transfer bank'
              ELSE 'Lainnya'
            END AS metode,
            COUNT(*) AS transaksi, SUM(${OMSET}) AS omset
       FROM data_transaksi
      WHERE tanggal_proses >= ? AND tanggal_proses < ?
      GROUP BY metode
      ORDER BY omset DESC`,
    [awal, akhir],
  );
  return rows.map((r) => ({ metode: String(r.metode), transaksi: num(r.transaksi), omset: num(r.omset) }));
}

export interface BarisWaktu {
  /** 0–23 untuk jam; 1 (Minggu) – 7 (Sabtu) untuk hari. */
  kunci: number;
  transaksi: number;
  omset: number;
}

/**
 * Pola waktu pesanan. Memakai `time_stamp` (saat pesanan masuk), bukan
 * tanggal_proses (tanggal diproses, biasanya esok harinya).
 *
 * Pesanan marketplace (Shopee/Lazada) banyak yang time_stamp-nya nilai
 * pengisi Excel "1900-01-30 00:00:00" — 1.362 dari 4.574 pesanan Sep 2026.
 * Tanpa disaring, semuanya menumpuk di jam 00:00 dan hari Selasa. Hanya
 * time_stamp >= 2020 yang dipakai; jumlah yang terbuang ada di
 * `tanpaJam()` untuk keterangan di halaman.
 */
export async function polaWaktu(bulan: string, per: "jam" | "hari"): Promise<BarisWaktu[]> {
  const [awal, akhir] = rentang(bulan);
  const kunci = per === "jam" ? "HOUR(time_stamp)" : "DAYOFWEEK(time_stamp)";
  const rows = await query<Record<string, unknown>>(
    `SELECT ${kunci} AS kunci, COUNT(*) AS transaksi, SUM(${OMSET}) AS omset
       FROM data_transaksi
      WHERE tanggal_proses >= ? AND tanggal_proses < ?
        AND time_stamp >= '2020-01-01'
      GROUP BY ${kunci}
      HAVING kunci IS NOT NULL
      ORDER BY kunci`,
    [awal, akhir],
  );
  return rows.map((r) => ({ kunci: num(r.kunci), transaksi: num(r.transaksi), omset: num(r.omset) }));
}

/** Pesanan bulan itu yang jam masuknya tidak tercatat (time_stamp kosong/pengisi). */
export async function tanpaJam(bulan: string): Promise<number> {
  const [awal, akhir] = rentang(bulan);
  const [r] = await query<Record<string, unknown>>(
    `SELECT SUM(time_stamp IS NULL OR time_stamp < '2020-01-01') AS n
       FROM data_transaksi
      WHERE tanggal_proses >= ? AND tanggal_proses < ?`,
    [awal, akhir],
  );
  return num(r?.n);
}

export interface BarisUkuran {
  ukuran: string;
  transaksi: number;
  omset: number;
}

/** Jumlah box per pesanan: 1, 2, 3, 4, 5–9, 10+. */
export async function ukuranPesanan(bulan: string): Promise<BarisUkuran[]> {
  const [awal, akhir] = rentang(bulan);
  const rows = await query<Record<string, unknown>>(
    `SELECT CASE
              WHEN box <= 1 THEN '1 box'
              WHEN box = 2 THEN '2 box'
              WHEN box = 3 THEN '3 box'
              WHEN box = 4 THEN '4 box'
              WHEN box < 10 THEN '5–9 box'
              ELSE '10+ box'
            END AS ukuran,
            MIN(box) AS urut, COUNT(*) AS transaksi, SUM(omset) AS omset
       FROM (
         SELECT ${BARANG} AS box, ${OMSET} AS omset
           FROM data_transaksi
          WHERE tanggal_proses >= ? AND tanggal_proses < ?
       ) AS x
      GROUP BY ukuran
      ORDER BY urut`,
    [awal, akhir],
  );
  return rows.map((r) => ({ ukuran: String(r.ukuran), transaksi: num(r.transaksi), omset: num(r.omset) }));
}

/* ── PRODUK ─────────────────────────────────────────────────── */

/**
 * Satu pesanan bisa berisi sampai 5 barang (27% pesanan berisi >1
 * barang, Sep 2026), sering dengan bonus berharga 0 (mis. G'Nait). Jadi
 * produk TIDAK diambil dari barang_1 saja: tiap baris barang dihitung
 * sendiri, dan omset pesanan dibagi ke barisnya menurut porsi harga baris.
 * Pesanan yang seluruh harganya 0 omsetnya masuk ke barang pertama.
 * Box dari baris berharga 0 dicatat sebagai bonus, terpisah.
 */
const PRODUK_DARI = (kolom: string) => `CASE UPPER(TRIM(${kolom}))
    WHEN 'GAMAMILK' THEN 'Gamamilk'
    WHEN 'GAMAMILK PREMIUM' THEN 'Gamamilk Premium'
    WHEN 'GAMAMILK PLUS' THEN 'Gamamilk Plus'
    WHEN 'GAMAMILK SEREAL' THEN 'Gamamilk Sereal'
    WHEN 'PHENOBODY' THEN 'Phenobody'
    WHEN 'GNAIT' THEN 'G''Nait'
    WHEN 'ETACEFIT' THEN 'Etacefit'
    ELSE 'Lainnya'
  END`;

/**
 * CTE `b` = satu baris per BARANG dalam [awal, akhir) (parameter: awal, akhir).
 *
 * Tiap pesanan dibaca SEKALI di CTE `o` (kolom harga/jumlah berupa teks
 * dan pembacaannya mahal), baru dipecah jadi 5 baris barang. Versi awal
 * yang membaca ulang per baris barang butuh 7,4 dtk untuk tren 12 bulan.
 */
function cteBarang(): string {
  const kolom = [1, 2, 3, 4, 5]
    .map(
      (i) => `${PRODUK_DARI(`barang_${i}`)} AS p${i}, ${qty(`jumlah_${i}`)} AS j${i},
              ${money(`harga_${i}`)} AS h${i}, COALESCE(TRIM(barang_${i}), '') <> '' AS ada${i}`,
    )
    .join(",\n");
  const baris = [1, 2, 3, 4, 5]
    .map(
      (i) => `SELECT pesanan, tanggal_proses, p${i} AS produk, j${i} AS box, h${i} AS harga,
                     CASE WHEN (h1 + h2 + h3 + h4 + h5) > 0
                          THEN h${i} / (h1 + h2 + h3 + h4 + h5) * omset
                          ELSE ${i === 1 ? "omset" : "0"}
                     END AS omset
                FROM o WHERE ada${i}`,
    )
    .join("\n UNION ALL \n");
  /* LIMIT di dalam CTE `o` memaksa database MENYIMPAN hasilnya sekali
     (CTE ber-LIMIT tidak bisa dilebur ke query luar). Tanpa itu MySQL
     melebur `o` ke kelima cabang UNION dan membaca ulang semua kolom teks
     5×: tren 12 bulan ±8 dtk, padahal sekali baca hanya ±1,6 dtk. */
  return `WITH o AS (
            SELECT id AS pesanan, tanggal_proses, ${OMSET} AS omset, ${kolom}
              FROM data_transaksi
             WHERE tanggal_proses >= ? AND tanggal_proses < ?
             LIMIT 1000000000
          ), b AS (${baris})`;
}

export interface BarisProduk {
  produk: string;
  omset: number;
  /** Box dari baris berharga > 0. */
  box: number;
  /** Box dari baris berharga 0 (bonus/hadiah). */
  boxBonus: number;
  /** Pesanan yang memuat produk ini (berbayar). */
  pesanan: number;
}

export async function perProduk(bulan: string, sampaiHari?: number): Promise<BarisProduk[]> {
  const [awal, akhir] = rentang(bulan, sampaiHari);
  const rows = await query<Record<string, unknown>>(
    `${cteBarang()}
     SELECT produk, SUM(omset) AS omset,
            SUM(CASE WHEN harga > 0 THEN box ELSE 0 END) AS box,
            SUM(CASE WHEN harga > 0 THEN 0 ELSE box END) AS box_bonus,
            COUNT(DISTINCT CASE WHEN harga > 0 THEN pesanan END) AS pesanan
       FROM b
      GROUP BY produk
      ORDER BY omset DESC`,
    [awal, akhir],
  );
  return rows.map((r) => ({
    produk: String(r.produk),
    omset: num(r.omset),
    box: num(r.box),
    boxBonus: num(r.box_bonus),
    pesanan: num(r.pesanan),
  }));
}

export interface TrenProduk {
  bulan: string;
  perProduk: Record<string, number>;
}

/** Hasil tren disimpan 5 menit: ±2,5 dtk untuk 12 bulan, dan bulan yang
 *  sudah lewat tidak berubah. Pola yang sama dengan tren di halaman Omset. */
const memoTren = new Map<string, { pada: number; nilai: Promise<TrenProduk[]> }>();

/** Omset per produk per bulan, `jumlahBulan` terakhir s/d `bulan`. */
export function trenProduk(bulan: string, jumlahBulan = 12): Promise<TrenProduk[]> {
  const kunci = `${bulan}:${jumlahBulan}`;
  const ada = memoTren.get(kunci);
  if (ada && Date.now() - ada.pada < 5 * 60_000) return ada.nilai;
  const nilai = ambilTrenProduk(bulan, jumlahBulan);
  memoTren.set(kunci, { pada: Date.now(), nilai });
  nilai.catch(() => memoTren.delete(kunci));
  return nilai;
}

async function ambilTrenProduk(bulan: string, jumlahBulan: number): Promise<TrenProduk[]> {
  const tahun = Number(bulan.slice(0, 4));
  const ke = Number(bulan.slice(5, 7));
  const mulai = tahun * 12 + (ke - 1) - (jumlahBulan - 1);
  const awal = `${Math.floor(mulai / 12)}-${String((mulai % 12) + 1).padStart(2, "0")}-01`;
  const [, akhir] = batasBulan(bulan);
  const rows = await query<Record<string, unknown>>(
    `${cteBarang()}
     SELECT DATE_FORMAT(tanggal_proses, '%Y-%m') AS bln, produk, SUM(omset) AS omset
       FROM b
      GROUP BY DATE_FORMAT(tanggal_proses, '%Y-%m'), produk`,
    [awal, akhir],
  );
  const peta = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const b = String(r.bln);
    if (!peta.has(b)) peta.set(b, {});
    peta.get(b)![String(r.produk)] = num(r.omset);
  }
  /* Deret dari daftar bulan, bukan dari hasil query: bulan tanpa transaksi
     tetap muncul sebagai nol supaya sumbu waktunya tidak memampat. */
  return Array.from({ length: jumlahBulan }, (_, i) => {
    const t = mulai + i;
    const kunci = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
    return { bulan: kunci, perProduk: peta.get(kunci) ?? {} };
  });
}

/* ── WILAYAH ────────────────────────────────────────────────── */

/** "JAWA BARAT" / "jawa barat" → "Jawa Barat"; singkatan DKI/DI/NTB/NTT tetap kapital. */
function rapikanNama(t: string): string {
  if (t === "(tidak diisi)") return t;
  const KAPITAL = new Set(["DKI", "DI", "NTB", "NTT", "II", "III"]);
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((k) => (KAPITAL.has(k.toUpperCase()) ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1)))
    .join(" ");
}

export interface BarisWilayah {
  nama: string;
  /** Provinsi induk — hanya diisi untuk baris kota. */
  provinsi?: string;
  omset: number;
  transaksi: number;
  pembeli: number;
}

/**
 * Omset per provinsi atau kota. Nama dirapikan (TRIM, huruf besar-kecil
 * disamakan) karena ejaan di data campur: "DKI Jakarta" / "Dki Jakarta".
 */
export async function perWilayah(bulan: string, per: "provinsi" | "kota", batas?: number): Promise<BarisWilayah[]> {
  const [awal, akhir] = rentang(bulan);
  const nama = (k: string) => `COALESCE(NULLIF(TRIM(${k}), ''), '(tidak diisi)')`;
  const kelompok = per === "provinsi" ? `UPPER(${nama("provinsi")})` : `UPPER(${nama("kota")}), UPPER(${nama("provinsi")})`;
  const rows = await query<Record<string, unknown>>(
    `SELECT MIN(${nama(per)}) AS nama,
            ${per === "kota" ? `MIN(${nama("provinsi")}) AS provinsi,` : ""}
            SUM(${OMSET}) AS omset, COUNT(*) AS transaksi,
            COUNT(DISTINCT NULLIF(TRIM(contack), '')) AS pembeli
       FROM data_transaksi
      WHERE tanggal_proses >= ? AND tanggal_proses < ?
      GROUP BY ${kelompok}
      ORDER BY omset DESC
      ${batas ? `LIMIT ${Math.floor(batas)}` : ""}`,
    [awal, akhir],
  );
  return rows.map((r) => ({
    nama: rapikanNama(String(r.nama)),
    provinsi: r.provinsi === undefined ? undefined : rapikanNama(String(r.provinsi)),
    omset: num(r.omset),
    transaksi: num(r.transaksi),
    pembeli: num(r.pembeli),
  }));
}

/* ── pilihan bulan (sama dengan halaman Omset) ──────────────── */

/** Bulan kalender berjalan menurut zona waktu laporan. */
function bulanSaatIni(): string {
  const b = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${b.find((x) => x.type === "year")!.value}-${b.find((x) => x.type === "month")!.value}`;
}

/**
 * Bulan aktif dari ?bulan=, daftar pilihan, dan bulan pembanding (bulan
 * sebelumnya yang punya data). Bulan berjalan selalu ada di pilihan.
 */
export async function pilihBulan(diminta?: string): Promise<{ bulan: string; tersedia: string[]; sebelum: string | null }> {
  const data = await listBulan();
  const kini = bulanSaatIni();
  const tersedia = [...new Set([kini, ...data])].sort((a, b) => b.localeCompare(a));
  const bulan = diminta && tersedia.includes(diminta) ? diminta : kini;
  return { bulan, tersedia, sebelum: data.find((b) => b < bulan) ?? null };
}
