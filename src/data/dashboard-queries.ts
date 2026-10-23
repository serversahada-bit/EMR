import "server-only";

import { query } from "./db";
import { OMSET, batasBulan, batasHari, hariDalamBulan } from "./omset-queries";

/* ──────────────────────────────────────────────────────────────
   Angka dashboard — seluruhnya dari data operasional.

   Rumus omset diimpor dari omset-queries, bukan ditulis ulang:
   dashboard dan halaman Omset yang menampilkan angka berbeda untuk
   bulan yang sama adalah bug yang mahal untuk ditemukan.

   TIDAK ada metrik laba, arus kas, atau target di sini. Database ini
   tidak memuat HPP, beban pegawai, opex, maupun target omset, jadi
   angka seperti itu hanya bisa dikarang — dan laporan eksekutif yang
   memuat angka karangan lebih berbahaya daripada yang kosong.
   ────────────────────────────────────────────────────────────── */

const num = (value: unknown): number => Number(value ?? 0);

export interface RingkasDashboard {
  omset: number;
  transaksi: number;
  customerBaru: number;
  /** Biaya pemasaran (spend total COS) — nama field dipertahankan. */
  spendIklan: number;
  /**
   * Omset sampai hari terakhir yang punya data biaya pemasaran — penyebut
   * COS. Sama dengan `omset` bila data biaya sudah selengkap transaksi.
   * Tanpa ini COS bulan berjalan tampak terlalu bagus: Oktober 2026
   * menunjukkan 33,5% (omset s/d tgl 22 terhadap biaya s/d tgl 20),
   * padahal dengan cut-off yang sama 41%.
   */
  omsetSebanding: number;
  /**
   * Target COS bulan itu dari laporan Marketing (baris TOTAL ALL BRAND),
   * mis. 0,4069 untuk September 2026. Null bila bulan itu tidak punya
   * target — angka target tidak boleh dikarang.
   */
  targetCos: number | null;
  lead: number;
  box: number;
  /**
   * Hari terakhir yang punya transaksi dan yang punya data iklan.
   *
   * Dibawa terpisah karena tabel iklan kerap tertinggal beberapa hari
   * dari tabel transaksi. Tanpa ini ROAS bulan berjalan tampak melonjak
   * — Oktober 2026 menunjukkan 16,8× hanya karena belanja iklannya baru
   * terisi 2 hari sementara omsetnya sudah 5 hari.
   */
  hariTerakhirTransaksi: string | null;
  hariTerakhirIklan: string | null;
}

/**
 * Periode "tanggal 1 sampai hari ke-N" untuk membandingkan bulan yang
 * belum selesai dengan rentang tanggal yang sama di bulan sebelumnya.
 * Membandingkan Oktober 1–22 dengan September penuh membuat omset tampak
 * turun 23% padahal cuma kurang 8 hari.
 */
export interface PotongPeriode {
  /** Hari terakhir (inklusif) untuk transaksi dan customer baru. */
  hariTransaksi: number;
  /**
   * Hari terakhir (inklusif) untuk biaya pemasaran, lead, dan box.
   * Dipisah dari transaksi karena sheet biaya kerap tertinggal 2–3 hari.
   */
  hariBiaya: number;
  /** Jumlah hari bulan yang dipotong — N sebesar ini berarti bulan penuh. */
  jumlahHari: number;
}

/**
 * Potongan pembanding untuk `bulanSebelum` agar setara dengan `bulan`.
 *
 * Null bila `bulan` sudah lengkap (transaksi dan biaya sampai hari
 * terakhir) — bulan lengkap tetap dibandingkan penuh lawan penuh. Hari
 * dibatasi panjang bulan sebelumnya: 30 Maret lawan Februari = Februari
 * penuh.
 */
export function potongSetara(
  bulan: string,
  bulanSebelum: string,
  ringkas: Pick<RingkasDashboard, "hariTerakhirTransaksi" | "hariTerakhirIklan">,
): PotongPeriode | null {
  const hariDari = (tgl: string | null) =>
    tgl && tgl.startsWith(bulan) ? Number(tgl.slice(8, 10)) : null;

  const transaksi = hariDari(ringkas.hariTerakhirTransaksi);
  if (transaksi === null) return null;
  const biaya = hariDari(ringkas.hariTerakhirIklan) ?? transaksi;

  const penuh = hariDalamBulan(bulan);
  if (transaksi >= penuh && biaya >= penuh) return null;

  const jumlahHari = hariDalamBulan(bulanSebelum);
  return {
    hariTransaksi: Math.min(transaksi, jumlahHari),
    hariBiaya: Math.min(biaya, jumlahHari),
    jumlahHari,
  };
}

export interface TitikTren {
  /** "2026-09" */
  bulan: string;
  omset: number;
  /** Biaya pemasaran (spend total COS). */
  spendIklan: number;
  /** Omset sampai hari terakhir data biaya bulan itu — penyebut COS. */
  omsetSebanding: number;
}

export interface OmsetChannel {
  channel: string;
  omset: number;
  transaksi: number;
}

/**
 * Kelompok channel untuk satu baris transaksi.
 *
 * Kolom `adv` berisi gabungan kode dan kanal ("DHANI:MT", "CRM:-",
 * "SHOPEE"); bagian sebelum titik dua inilah yang cocok dengan
 * `data_channel.kelompok_adv`. Pada September 2026 pemetaan ini menutup
 * seluruh 4.574 transaksi tanpa sisa.
 */
const CHANNEL = `COALESCE(c.kelompok_channel, '(tidak terpetakan)')`;
const JOIN_CHANNEL = `LEFT JOIN data_channel c
    ON c.kelompok_adv = SUBSTRING_INDEX(t.adv, ':', 1)`;

/**
 * Belanja iklan = spend total sheet COST OF SALES tiap file Progres
 * (`data_cos_harian`), semua produk. Omset dashboard dijumlah dari seluruh
 * transaksi lintas kanal, jadi penyebut ROAS dan biaya akuisisi juga harus
 * seluruh pengeluaran marketing — dengan Meta saja, ROAS tampak jauh lebih
 * bagus dari kenyataannya.
 *
 * Kolom-kolomnya memetakan pos pengeluaran yang dipakai manajemen:
 *  - KONVERSI        → Meta (dengan PPN), Google, marketplace, TikTok
 *  - SALES PROMOTION → CRM/CSO (biaya chat, ongkir, promo, free produk)
 *  - MBC             → Marcom
 *
 * Dipilih ketimbang menjumlah tabel spend per kanal karena tabel kanal
 * bolong (TikTok Agustus–September 2026 tidak ada di `data_spend_mp`) dan
 * tidak memuat CRM maupun Marcom. September 2026: COS 414,4 jt terhadap
 * angka pengeluaran resmi 519,6 jt (79,8%); sisa selisihnya ada di pos
 * Meta, yang angka resminya (248,7 jt) tidak tercatat di file mana pun.
 *
 * Hanya `jenis = 'DATA'`: baris `LEBIH HARI` tanggalnya NULL (baris ke-31
 * di bulan 30 hari) — terfilter sendiri oleh rentang tanggal, tapi tetap
 * ditulis eksplisit seperti di cos-queries.
 */
const SPEND_COS = `FROM data_cos_harian
       WHERE jenis = 'DATA' AND tanggal >= ? AND tanggal < ?`;

/**
 * Baris yang benar-benar ada belanjanya. Sheet COS sudah memuat baris
 * sampai akhir bulan, dan kolom LAIN-LAIN terisi recehan (17–39 rupiah)
 * di tanggal yang belum terjadi — Oktober 2026 sampai tgl 27 saat hari
 * ini tgl 23. Karena itu hanya pos nyata yang dihitung (konversi, MBC,
 * sales promotion); tanpa ini tanggal terakhir data biaya selalu tampak
 * lengkap dan peringatan "belum lengkap" tidak pernah muncul.
 */
const ADA_SPEND = `COALESCE(spend_konversi, 0) + COALESCE(spend_mbc, 0)
                   + COALESCE(spend_sales_promotion, 0) > 0`;

/** Omset dari `awal` sampai `sampai` (inklusif) — penyebut COS yang sebanding. */
async function omsetSampai(awal: string, sampai: string): Promise<number> {
  const rows = await query<Record<string, unknown>>(
    `SELECT SUM(${OMSET}) AS omset
     FROM data_transaksi t
     WHERE t.tanggal_proses >= ? AND t.tanggal_proses <= ?`,
    [awal, sampai],
  );
  return num(rows[0]?.omset);
}

/**
 * Penyebut COS: omset dipotong di hari terakhir data biaya bila data biaya
 * tertinggal dari transaksi; selain itu omset penuh.
 */
async function omsetSebanding(
  awal: string,
  omset: number,
  hariTerakhirTransaksi: string | null,
  hariTerakhirSpend: string | null,
): Promise<number> {
  if (
    hariTerakhirSpend !== null &&
    hariTerakhirTransaksi !== null &&
    hariTerakhirSpend < hariTerakhirTransaksi
  ) {
    return omsetSampai(awal, hariTerakhirSpend);
  }
  return omset;
}

/**
 * Ringkasan satu bulan. Dengan `potong`, hanya tanggal 1 s/d hari yang
 * ditentukan yang dihitung — dipakai untuk bulan pembanding agar setara
 * dengan bulan berjalan (lihat `potongSetara`).
 */
export async function ringkasDashboard(
  bulan: string,
  potong?: PotongPeriode,
): Promise<RingkasDashboard> {
  const [awal, akhirBulan] = batasBulan(bulan);
  const akhirTransaksi = potong
    ? batasHari(bulan, potong.hariTransaksi)
    : akhirBulan;
  const akhirBiaya = potong ? batasHari(bulan, potong.hariBiaya) : akhirBulan;

  const [transaksi, customer, iklan, metaLead, targetRow] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT COUNT(*) AS transaksi, SUM(${OMSET}) AS omset,
              MAX(t.tanggal_proses) AS hari_akhir
       FROM data_transaksi t
       WHERE t.tanggal_proses >= ? AND t.tanggal_proses < ?`,
      [awal, akhirTransaksi],
    ),
    query<{ jumlah: unknown }>(
      `SELECT COUNT(*) AS jumlah FROM data_customer
       WHERE tgl_reg >= ? AND tgl_reg < ?`,
      [awal, akhirTransaksi],
    ),
    query<Record<string, unknown>>(
      `SELECT SUM(spend_total) AS spend,
              MAX(CASE WHEN ${ADA_SPEND} THEN tanggal END) AS hari_akhir
       ${SPEND_COS}`,
      [awal, akhirBiaya],
    ),
    /* Lead & box hanya tercatat rapi di sumber Meta utama. */
    query<Record<string, unknown>>(
      `SELECT SUM(total_lead_real) AS lead_real,
              SUM(box_total) AS box
       FROM data_spend_meta
       WHERE sumber_tabel = 'data_spend_meta_harian'
         AND tanggal >= ? AND tanggal < ?`,
      [awal, akhirBiaya],
    ),
    /* Target COS resmi per bulan dari laporan Marketing. Bulan tanpa
       laporan (2025) tidak punya baris ini → target null. */
    query<Record<string, unknown>>(
      `SELECT MAX(target_cos) AS target_cos
       FROM data_monitoring_kanal
       WHERE agregat = 1 AND kanal = 'TOTAL' AND produk = 'ALL BRAND'
         AND tahun = ? AND bulan_no = ?`,
      [Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7))],
    ),
  ]);

  const omset = num(transaksi[0]?.omset);
  const hariTerakhirTransaksi = (transaksi[0]?.hari_akhir as string) ?? null;
  const hariTerakhirIklan = (iklan[0]?.hari_akhir as string) ?? null;
  const target = num(targetRow[0]?.target_cos);

  return {
    omset,
    transaksi: num(transaksi[0]?.transaksi),
    customerBaru: num(customer[0]?.jumlah),
    spendIklan: num(iklan[0]?.spend),
    omsetSebanding: await omsetSebanding(
      awal,
      omset,
      hariTerakhirTransaksi,
      hariTerakhirIklan,
    ),
    targetCos: target > 0 ? target : null,
    lead: num(metaLead[0]?.lead_real),
    box: num(metaLead[0]?.box),
    hariTerakhirTransaksi,
    hariTerakhirIklan,
  };
}

/** Omset dan biaya pemasaran berdampingan, `jumlahBulan` terakhir. */
export async function trenDashboard(
  bulan: string,
  jumlahBulan = 12,
): Promise<TitikTren[]> {
  const tahun = Number(bulan.slice(0, 4));
  const ke = Number(bulan.slice(5, 7));
  const total = tahun * 12 + (ke - 1) - (jumlahBulan - 1);
  const awal = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
  const [, akhir] = batasBulan(bulan);

  const [omset, iklan] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT DATE_FORMAT(t.tanggal_proses, '%Y-%m') AS bulan,
              SUM(${OMSET}) AS omset,
              MAX(t.tanggal_proses) AS hari_akhir
       FROM data_transaksi t
       WHERE t.tanggal_proses >= ? AND t.tanggal_proses < ?
       GROUP BY bulan`,
      [awal, akhir],
    ),
    query<Record<string, unknown>>(
      /* Group berdasarkan ekspresi penuh, bukan alias `bulan`: tabel COS
         punya kolom asli bernama `bulan`, dan MySQL menafsirkan
         `GROUP BY bulan` sebagai kolom itu — bukan alias di SELECT. */
      `SELECT DATE_FORMAT(tanggal, '%Y-%m') AS bulan,
              SUM(spend_total) AS spend,
              MAX(CASE WHEN ${ADA_SPEND} THEN tanggal END) AS hari_akhir
       ${SPEND_COS}
       GROUP BY DATE_FORMAT(tanggal, '%Y-%m')`,
      [awal, akhir],
    ),
  ]);

  const perOmset = new Map(omset.map((r) => [String(r.bulan), r]));
  const perSpend = new Map(iklan.map((r) => [String(r.bulan), r]));

  /* Deret dirakit dari daftar bulan, bukan dari hasil query: bulan yang
     tidak punya transaksi harus tetap muncul sebagai nol agar grafik
     tidak memampatkan sumbu waktunya. Penyebut COS tiap bulan dipotong di
     hari terakhir data biaya — dalam praktik hanya bulan berjalan yang
     perlu query tambahan; bulan lain lengkap dan memakai omset penuh. */
  return Promise.all(
    Array.from({ length: jumlahBulan }, async (_, i) => {
      const t = total + i;
      const kunci = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
      const o = perOmset.get(kunci);
      const s = perSpend.get(kunci);
      const omsetBulan = num(o?.omset);
      return {
        bulan: kunci,
        omset: omsetBulan,
        spendIklan: num(s?.spend),
        omsetSebanding: await omsetSebanding(
          `${kunci}-01`,
          omsetBulan,
          (o?.hari_akhir as string) ?? null,
          (s?.hari_akhir as string) ?? null,
        ),
      };
    }),
  );
}

export async function omsetPerChannel(
  bulan: string,
): Promise<OmsetChannel[]> {
  const [awal, akhir] = batasBulan(bulan);

  const rows = await query<Record<string, unknown>>(
    `SELECT ${CHANNEL} AS channel,
            COUNT(*) AS transaksi,
            SUM(${OMSET}) AS omset
     FROM data_transaksi t
     ${JOIN_CHANNEL}
     WHERE t.tanggal_proses >= ? AND t.tanggal_proses < ?
     GROUP BY channel
     ORDER BY omset DESC`,
    [awal, akhir],
  );

  return rows.map((row) => ({
    channel: String(row.channel),
    omset: num(row.omset),
    transaksi: num(row.transaksi),
  }));
}
