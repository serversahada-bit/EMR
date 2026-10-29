import "server-only";

import { query } from "./db";
import { monitoringLive } from "./monitoring-sheet";
import {
  BARANG,
  OMSET,
  batasBulan,
  batasHari,
  hariSetara,
  ringkasBulan,
} from "./omset-queries";

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

/* ──────────────────────────────────────────────────────────────
   OMSET, BOX, CLOSING diambil dari data_transaksi — bukan dari sheet.

   Sheet Marketing Report baru masuk ke database saat diimpor manual, jadi
   bulan berjalan selalu tertinggal (Oktober 2026: sheet 706,4 jt ≈ data
   s/d tgl 20, sementara transaksi sudah s/d tgl 23). data_transaksi
   ter-sync otomatis, dan rumus omsetnya SAMA dengan dashboard dan halaman
   Omset, sehingga ketiga halaman menampilkan angka yang sama.

   Yang tetap dari sheet: biaya (spend), alokasi, dan target — data
   transaksi tidak memuat biaya.

   Pemetaan kanal lewat data_channel (kelompok_adv = bagian `adv` sebelum
   titik dua). Diuji September 2026 — dekat dengan sheet:
     CRM          -> CRM     (456,2 jt vs sheet 449,6 jt)
     CSO          -> META    (133,9 jt vs 125,1 jt; order dari iklan per ADV)
     SHOPEE       -> MP      (358,5 jt vs 369,5 jt)
     MARKETPLACE  -> TIKTOK  untuk TikTok/Tokopedia, selebihnya MP
     NON PENJUALAN (endorse, internal) -> MARKOM
   Kanal META x SHOPEE dan SNACK tidak punya pasangan di transaksi (order-
   nya tercatat sebagai Shopee/CSO), jadi omsetnya 0 dan COS-nya "—";
   biayanya tetap ikut total.

   Produk dari `barang_1` (barang pertama di pesanan). Pesanan campuran
   dihitung ke produk pertamanya.
   ────────────────────────────────────────────────────────────── */

const KANAL_TRANSAKSI = `CASE
    WHEN c.kelompok_channel = 'CRM' THEN 'CRM'
    WHEN c.kelompok_channel = 'CSO' THEN 'META'
    WHEN c.kelompok_channel = 'SHOPEE' THEN 'MP'
    WHEN c.kelompok_channel = 'MARKETPLACE'
         AND c.kelompok_adv IN ('TIKTOK', 'TOKOPEDIA') THEN 'TIKTOK'
    WHEN c.kelompok_channel = 'MARKETPLACE' THEN 'MP'
    WHEN c.kelompok_channel = 'NON PENJUALAN' THEN 'MARKOM'
  END`;

const PRODUK_TRANSAKSI = `CASE UPPER(TRIM(t.barang_1))
    WHEN 'GAMAMILK' THEN 'Gamamilk'
    WHEN 'GAMAMILK PLUS' THEN 'Gamamilk Plus'
    WHEN 'GAMAMILK PREMIUM' THEN 'Gamamilk Premium'
    WHEN 'GAMAMILK SEREAL' THEN 'Gamamilk Sereal'
    WHEN 'PHENOBODY' THEN 'Phenobody'
    WHEN 'GNAIT' THEN 'G''Nait'
    WHEN 'ETACEFIT' THEN 'Etacefit'
  END`;

/** Grup kanal untuk baris yang ada di transaksi tetapi tidak di sheet. */
const GRUP_KANAL: Record<string, string> = {
  META: "SOSCOM",
  CRM: "SOSCOM",
  MP: "ECOMMERCE",
  TIKTOK: "ECOMMERCE",
  MARKOM: "LAIN",
};

interface Ukuran {
  omset: number;
  box: number;
  closing: number;
}

/** Omset, box, closing per (produk, kanal) dalam [awal, akhir). */
async function ukuranTransaksi(
  awal: string,
  akhir: string,
): Promise<{ produk: string | null; kanal: string | null; u: Ukuran }[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT produk, kanal, COUNT(*) AS closing,
            SUM(omset) AS omset, SUM(box) AS box
       FROM (
         SELECT ${PRODUK_TRANSAKSI} AS produk,
                ${KANAL_TRANSAKSI} AS kanal,
                ${OMSET} AS omset,
                ${BARANG} AS box
           FROM data_transaksi t
           LEFT JOIN data_channel c
             ON c.kelompok_adv = SUBSTRING_INDEX(t.adv, ':', 1)
          WHERE t.tanggal_proses >= ? AND t.tanggal_proses < ?
       ) AS x
      GROUP BY produk, kanal`,
    [awal, akhir],
  );
  return rows.map((r) => ({
    produk: r.produk === null ? null : String(r.produk),
    kanal: r.kanal === null ? null : String(r.kanal),
    u: {
      omset: Number(r.omset ?? 0),
      box: Number(r.box ?? 0),
      closing: Number(r.closing ?? 0),
    },
  }));
}

const nol = (): Ukuran => ({ omset: 0, box: 0, closing: 0 });
const tambah = (a: Ukuran, b: Ukuran) => {
  a.omset += b.omset;
  a.box += b.box;
  a.closing += b.closing;
};

/**
 * Timpa omset/box/closing baris sheet dengan angka transaksi, dan tambahkan
 * baris yang ada di transaksi tetapi tidak di sheet (produk atau kanal
 * yang bulan itu belum punya blok di sheet).
 */
function pakaiTransaksi(
  sheet: BarisMonitoring[],
  trx: { produk: string | null; kanal: string | null; u: Ukuran }[],
): BarisMonitoring[] {
  const perPK = new Map<string, Ukuran>();
  const perProduk = new Map<string, Ukuran>();
  const perKanal = new Map<string, Ukuran>();
  const semua = nol();
  for (const { produk, kanal, u } of trx) {
    tambah(semua, u);
    if (kanal) {
      if (!perKanal.has(kanal)) perKanal.set(kanal, nol());
      tambah(perKanal.get(kanal)!, u);
    }
    if (produk) {
      if (!perProduk.has(produk)) perProduk.set(produk, nol());
      tambah(perProduk.get(produk)!, u);
      if (kanal) {
        const k = `${produk}|${kanal}`;
        if (!perPK.has(k)) perPK.set(k, nol());
        tambah(perPK.get(k)!, u);
      }
    }
  }

  const ukuranUntuk = (produk: string, kanal: string, agregat: boolean) => {
    if (produk === ALL_BRAND) return agregat ? semua : perKanal.get(kanal);
    return agregat ? perProduk.get(produk) : perPK.get(`${produk}|${kanal}`);
  };
  const timpa = (r: BarisMonitoring, u: Ukuran | undefined): BarisMonitoring => ({
    ...r,
    omset: u?.omset ?? 0,
    box: u?.box ?? 0,
    closing: u?.closing ?? 0,
  });
  const kosong = (produk: string, kanal: string, agregat: boolean, u: Ukuran): BarisMonitoring => ({
    produk,
    kanal,
    grup: agregat ? "TOTAL" : (GRUP_KANAL[kanal] ?? "LAIN"),
    agregat: agregat ? 1 : 0,
    alokasi: null,
    spend: null,
    targetBox: null,
    targetCos: null,
    targetCosEcom: null,
    targetCosSoscom: null,
    omset: u.omset,
    box: u.box,
    closing: u.closing,
  });

  const hasil = sheet.map((r) => timpa(r, ukuranUntuk(r.produk, r.kanal, Boolean(r.agregat))));
  const ada = new Set(hasil.map((r) => `${r.produk}|${r.agregat ? "TOTAL" : r.kanal}`));

  for (const [k, u] of perPK) {
    const [produk, kanal] = k.split("|");
    if (!ada.has(k)) hasil.push(kosong(produk, kanal, false, u));
  }
  for (const [produk, u] of perProduk) {
    if (!ada.has(`${produk}|TOTAL`)) hasil.push(kosong(produk, "TOTAL", true, u));
  }
  for (const [kanal, u] of perKanal) {
    if (!ada.has(`${ALL_BRAND}|${kanal}`)) hasil.push(kosong(ALL_BRAND, kanal, false, u));
  }
  if (!ada.has(`${ALL_BRAND}|TOTAL`)) hasil.push(kosong(ALL_BRAND, "TOTAL", true, semua));
  return hasil;
}

/**
 * Pembanding setara untuk bulan yang belum selesai: bulan ini s/d hari
 * ke-N lawan bulan lalu s/d hari ke-N yang sama (Oktober 1–23 lawan
 * September 1–23, bukan lawan September penuh).
 *
 * - Omset: dari data_transaksi, fungsi yang SAMA dengan halaman Omset,
 *   jadi persentasenya identik dengan dashboard dan halaman Omset.
 * - Biaya: dari sheet COS harian (`data_cos_harian`) — sheet monitoring
 *   tidak punya tanggal. Dipotong di hari terakhir yang ada belanjanya,
 *   hanya pos nyata (konversi, MBC, sales promotion): kolom LAIN-LAIN
 *   berisi recehan di tanggal yang belum terjadi.
 *
 * Masing-masing null bila bulan itu sudah lengkap di ukuran tersebut →
 * dibandingkan penuh lawan penuh.
 */
export interface PembandingHarian {
  omset: { hari: number; kini: number; lalu: number } | null;
  spend: { hari: number; kini: number; lalu: number } | null;
}

export async function pembandingHarian(
  bulan: string,
  bulanLalu: string,
): Promise<PembandingHarian> {
  // Omset — persis seperti halaman Omset.
  const kiniTrx = await ringkasBulan(bulan);
  const hariO = hariSetara(bulan, bulanLalu, kiniTrx.hariTerakhir);
  const omset = hariO
    ? {
        hari: hariO,
        kini: kiniTrx.omset,
        lalu: (await ringkasBulan(bulanLalu, hariO)).omset,
      }
    : null;

  // Biaya — dari COS harian.
  const [awal, akhir] = batasBulan(bulan);
  const [tepi] = await query<Record<string, unknown>>(
    `SELECT MAX(CASE WHEN COALESCE(spend_konversi, 0) + COALESCE(spend_mbc, 0)
                          + COALESCE(spend_sales_promotion, 0) > 0
                     THEN tanggal END) AS hari
       FROM data_cos_harian
      WHERE jenis = 'DATA' AND tanggal >= ? AND tanggal < ?`,
    [awal, akhir],
  );
  const hariS = hariSetara(bulan, bulanLalu, tepi?.hari ? String(tepi.hari).slice(0, 10) : null);
  const spendSampai = async (b: string, hari: number) => {
    const [r] = await query<Record<string, unknown>>(
      `SELECT SUM(spend_total) AS s FROM data_cos_harian
        WHERE jenis = 'DATA' AND tanggal >= ? AND tanggal < ?`,
      [batasBulan(b)[0], batasHari(b, hari)],
    );
    return Number(r?.s ?? 0);
  };
  const spend = hariS
    ? {
        hari: hariS,
        kini: await spendSampai(bulan, hariS),
        lalu: await spendSampai(bulanLalu, hariS),
      }
    : null;

  return { omset, spend };
}

/** Bulan yang tersedia, "YYYY-MM", terbaru dulu. */
export async function bulanMonitoring(): Promise<string[]> {
  const [rows, live] = await Promise.all([
    query<{ b: string }>(
      `SELECT DISTINCT CONCAT(tahun, '-', LPAD(bulan_no, 2, '0')) AS b
         FROM data_monitoring_kanal`,
    ).catch(() => []),
    liveAman(new Date().getFullYear()),
  ]);
  const semua = new Set(rows.map((r) => String(r.b)));
  for (const b of live?.perBulan.keys() ?? []) semua.add(b);
  return [...semua].sort((a, b) => b.localeCompare(a));
}

/* ── sumber biaya, alokasi, target: sheet live, cadangan tabel impor ── */

/** Sheet live satu tahun; null (bukan galat) bila tidak bisa dibaca. */
async function liveAman(tahun: number) {
  try {
    return await monitoringLive(tahun);
  } catch {
    return null;
  }
}

export interface SumberBiaya {
  /** true = dibaca langsung dari sheet; false = dari impor terakhir. */
  live: boolean;
  diambil: string | null;
  /** Alasan memakai cadangan, atau catatan pengurai sheet. */
  catatan: string[];
}

/** Dari mana biaya/alokasi/target bulan itu diambil — untuk keterangan di halaman. */
export async function sumberBiaya(bulan: string): Promise<SumberBiaya> {
  const tahun = Number(bulan.slice(0, 4));
  try {
    const live = await monitoringLive(tahun);
    if (!live) return { live: false, diambil: null, catatan: [`Sheet Marketing Report ${tahun} belum terdaftar.`] };
    if (!live.perBulan.has(bulan)) {
      return { live: false, diambil: live.diambil, catatan: [`Tab bulan ini tidak terbaca utuh di sheet.`, ...live.catatan] };
    }
    return { live: true, diambil: live.diambil, catatan: live.catatan };
  } catch (e) {
    return { live: false, diambil: null, catatan: [`Sheet tidak bisa dibaca: ${e instanceof Error ? e.message : e}`] };
  }
}

/**
 * Semua baris satu bulan: biaya, alokasi, dan target dari sheet; omset,
 * box, dan closing dari data_transaksi (lihat blok komentar di atas).
 */
export async function dataMonitoring(bulan: string): Promise<BarisMonitoring[]> {
  const [awal, akhir] = batasBulan(bulan);
  const [sheet, trx] = await Promise.all([
    barisSheet(bulan),
    ukuranTransaksi(awal, akhir),
  ]);
  return pakaiTransaksi(sheet, trx);
}

/** Biaya, alokasi, target satu bulan: sheet live bila terbaca, selain itu impor. */
async function barisSheet(bulan: string): Promise<BarisMonitoring[]> {
  const live = await liveAman(Number(bulan.slice(0, 4)));
  const dariSheet = live?.perBulan.get(bulan);
  if (dariSheet) return dariSheet;
  return barisImpor(bulan);
}

/** Cadangan: tabel data_monitoring_kanal hasil impor_monitoring.py. */
async function barisImpor(bulan: string): Promise<BarisMonitoring[]> {
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

/**
 * Ringkasan per bulan: biaya & target dari blok ALL BRAND sheet; omset dan
 * box dari data_transaksi (rumus sama dengan dashboard).
 */
export async function trenMonitoring(): Promise<
  { bulan: string; omset: number; spend: number; box: number; targetBox: number; targetCos: number | null }[]
> {
  const impor = await query<Record<string, unknown>>(
    `SELECT CONCAT(tahun, '-', LPAD(bulan_no, 2, '0')) AS b,
            COALESCE(SUM(realisasi_spend), 0) AS spend,
            COALESCE(SUM(target_box), 0) AS target_box,
            MAX(target_cos) AS target_cos
       FROM data_monitoring_kanal WHERE agregat = 1 AND produk = 'ALL BRAND'
      GROUP BY tahun, bulan_no`,
  ).catch(() => []);

  /* Bulan yang terbaca di sheet live memakai angka live (blok ALL BRAND,
     kolom TOTAL); bulan lain — mis. tahun lalu — tetap dari impor. */
  const perB = new Map<string, { spend: number; targetBox: number; targetCos: number | null }>();
  for (const r of impor) {
    perB.set(String(r.b), {
      spend: Number(r.spend),
      targetBox: Number(r.target_box),
      targetCos: r.target_cos === null || r.target_cos === undefined ? null : Number(r.target_cos),
    });
  }
  const live = await liveAman(new Date().getFullYear());
  for (const [b, rs] of live?.perBulan ?? []) {
    const tot = rs.find((r) => r.produk === ALL_BRAND && r.agregat);
    if (tot) perB.set(b, { spend: tot.spend ?? 0, targetBox: tot.targetBox ?? 0, targetCos: tot.targetCos });
  }
  const rows = [...perB.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([b, v]) => ({ b, spend: v.spend, target_box: v.targetBox, target_cos: v.targetCos }));
  if (rows.length === 0) return [];

  const awal = `${String(rows[0].b)}-01`;
  const [, akhir] = batasBulan(String(rows[rows.length - 1].b));
  const trx = await query<Record<string, unknown>>(
    `SELECT DATE_FORMAT(t.tanggal_proses, '%Y-%m') AS b,
            SUM(${OMSET}) AS omset, SUM(${BARANG}) AS box
       FROM data_transaksi t
      WHERE t.tanggal_proses >= ? AND t.tanggal_proses < ?
      GROUP BY DATE_FORMAT(t.tanggal_proses, '%Y-%m')`,
    [awal, akhir],
  );
  const perBulan = new Map(trx.map((r) => [String(r.b), r]));

  return rows.map((r) => {
    const t = perBulan.get(String(r.b));
    return {
      bulan: String(r.b),
      omset: Number(t?.omset ?? 0),
      spend: Number(r.spend),
      box: Number(t?.box ?? 0),
      targetBox: Number(r.target_box),
      targetCos: r.target_cos === null || r.target_cos === undefined ? null : Number(r.target_cos),
    };
  });
}
