import "server-only";

import { query } from "./db";
import { OMSET, batasBulan } from "./omset-queries";

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
  spendIklan: number;
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

export interface TitikTren {
  /** "2026-09" */
  bulan: string;
  omset: number;
  spendIklan: number;
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

export async function ringkasDashboard(
  bulan: string,
): Promise<RingkasDashboard> {
  const [awal, akhir] = batasBulan(bulan);

  const [transaksi, customer, iklan] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT COUNT(*) AS transaksi, SUM(${OMSET}) AS omset,
              MAX(t.tanggal_proses) AS hari_akhir
       FROM data_transaksi t
       WHERE t.tanggal_proses >= ? AND t.tanggal_proses < ?`,
      [awal, akhir],
    ),
    query<{ jumlah: unknown }>(
      `SELECT COUNT(*) AS jumlah FROM data_customer
       WHERE tgl_reg >= ? AND tgl_reg < ?`,
      [awal, akhir],
    ),
    query<Record<string, unknown>>(
      `SELECT SUM(spend_iklan) AS spend,
              SUM(total_lead_real) AS lead_real,
              SUM(box_total) AS box,
              MAX(tanggal) AS hari_akhir
       FROM data_spend_meta_harian
       WHERE tanggal >= ? AND tanggal < ?`,
      [awal, akhir],
    ),
  ]);

  return {
    omset: num(transaksi[0]?.omset),
    transaksi: num(transaksi[0]?.transaksi),
    customerBaru: num(customer[0]?.jumlah),
    spendIklan: num(iklan[0]?.spend),
    lead: num(iklan[0]?.lead_real),
    box: num(iklan[0]?.box),
    hariTerakhirTransaksi: (transaksi[0]?.hari_akhir as string) ?? null,
    hariTerakhirIklan: (iklan[0]?.hari_akhir as string) ?? null,
  };
}

/** Omset dan belanja iklan berdampingan, `jumlahBulan` terakhir. */
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
              SUM(${OMSET}) AS omset
       FROM data_transaksi t
       WHERE t.tanggal_proses >= ? AND t.tanggal_proses < ?
       GROUP BY bulan`,
      [awal, akhir],
    ),
    query<Record<string, unknown>>(
      /* Group berdasarkan ekspresi penuh, bukan alias `bulan`: tabel ini
         punya kolom asli bernama `bulan` (berisi nama bulan seperti
         "Januari"), dan MySQL menafsirkan `GROUP BY bulan` sebagai kolom
         itu — menggabung lintas tahun sekaligus melanggar ONLY_FULL_GROUP_BY. */
      `SELECT DATE_FORMAT(tanggal, '%Y-%m') AS bulan,
              SUM(spend_iklan) AS spend
       FROM data_spend_meta_harian
       WHERE tanggal >= ? AND tanggal < ?
       GROUP BY DATE_FORMAT(tanggal, '%Y-%m')`,
      [awal, akhir],
    ),
  ]);

  const petaOmset = new Map(omset.map((r) => [String(r.bulan), num(r.omset)]));
  const petaSpend = new Map(iklan.map((r) => [String(r.bulan), num(r.spend)]));

  /* Deret dirakit dari daftar bulan, bukan dari hasil query: bulan yang
     tidak punya transaksi harus tetap muncul sebagai nol agar grafik
     tidak memampatkan sumbu waktunya. */
  const titik: TitikTren[] = [];
  for (let i = 0; i < jumlahBulan; i++) {
    const t = total + i;
    const kunci = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
    titik.push({
      bulan: kunci,
      omset: petaOmset.get(kunci) ?? 0,
      spendIklan: petaSpend.get(kunci) ?? 0,
    });
  }
  return titik;
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
