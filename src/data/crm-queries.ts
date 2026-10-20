import "server-only";

import { query } from "./db";

/**
 * CRM & blast — dari sheet PERFORMA BLAST CRM, CRM, dan CS <nama>/CSO
 * tiap file Progres (lihat build_all_crm.py). Tiga tabel gabungan:
 *
 *  - `data_crm_blast`: tanggal x produk. Spend blast (cost chat, ongkir,
 *    promo, free produk) + data, closing, box, omset.
 *  - `data_crm_ro`:    tanggal x produk x CS x segmen (RO 1 / RO 2 /
 *    RESELLER). `closing` = kolom ALAMAT di sheet (jumlah order).
 *  - `data_crm_cs`:    tanggal x produk x CS x sumber. jenis_cs AKUISISI
 *    (sumber = iklan: META PUTRA, CTWA, …) atau CRM (sumber = New
 *    Customer <ADV>, Reseller, RO …).
 *
 * SPEND BLAST SERING TERSALIN — ditemukan saat konsolidasi:
 *   - file Sereal memuat spend blast PERSIS sama dengan Gamamilk (box &
 *     omsetnya sendiri) -> spend itu milik Gamamilk, bukan Sereal;
 *   - spend Oktober 2026 PERSIS sama dengan September (sheet belum
 *     diperbarui, box & omset sudah angka Oktober).
 *   Spend seperti itu ditandai `spendSalinan` dan TIDAK dijumlahkan; box
 *   dan omset tetap dipakai. Kesamaan dinilai dari total sebulan sampai
 *   rupiah — kebetulan sama persis praktis mustahil.
 */

export interface BlastBulan {
  bulan: string;
  produk: string;
  hari: number;
  costChat: number;
  ongkir: number;
  promoHadiah: number;
  promoCb: number;
  freeProduk: number;
  spend: number;
  data: number;
  closing: number;
  box: number;
  omset: number;
  /** null = spend sah; selain itu alasan spend tidak dijumlahkan. */
  spendSalinan: string | null;
}

const n = (v: unknown) => Number(v ?? 0);

function bulanSebelum(b: string): string {
  const [y, m] = b.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Semua bulan x produk blast, dengan penanda spend tersalin. */
export async function blastBulanan(): Promise<BlastBulan[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT DATE_FORMAT(tanggal, '%Y-%m') AS bln, produk,
            COUNT(*) AS hari,
            COALESCE(SUM(cost_chat), 0) AS cost_chat,
            COALESCE(SUM(ongkir), 0) AS ongkir,
            COALESCE(SUM(promo_hadiah), 0) AS promo_hadiah,
            COALESCE(SUM(promo_cb), 0) AS promo_cb,
            COALESCE(SUM(free_produk), 0) AS free_produk,
            COALESCE(SUM(spend_total), 0) AS spend,
            COALESCE(SUM(data), 0) AS data_,
            COALESCE(SUM(closing), 0) AS closing,
            COALESCE(SUM(box), 0) AS box,
            COALESCE(SUM(omset), 0) AS omset
       FROM data_crm_blast
      GROUP BY DATE_FORMAT(tanggal, '%Y-%m'), produk
      ORDER BY bln, produk`,
  );
  const hasil: BlastBulan[] = rows.map((r) => ({
    bulan: String(r.bln),
    produk: String(r.produk),
    hari: n(r.hari),
    costChat: n(r.cost_chat),
    ongkir: n(r.ongkir),
    promoHadiah: n(r.promo_hadiah),
    promoCb: n(r.promo_cb),
    freeProduk: n(r.free_produk),
    spend: n(r.spend),
    data: n(r.data_),
    closing: n(r.closing),
    box: n(r.box),
    omset: n(r.omset),
    spendSalinan: null,
  }));
  const kunci = new Map(hasil.map((h) => [`${h.bulan}|${h.produk}`, h]));
  for (const h of hasil) {
    if (h.spend <= 0) continue;
    const gm = kunci.get(`${h.bulan}|Gamamilk`);
    const lalu = kunci.get(`${bulanSebelum(h.bulan)}|${h.produk}`);
    if (h.produk !== "Gamamilk" && gm && Math.round(gm.spend) === Math.round(h.spend)) {
      h.spendSalinan = "sama persis dengan spend Gamamilk";
    } else if (lalu && Math.round(lalu.spend) === Math.round(h.spend)) {
      h.spendSalinan = "sama persis dengan bulan sebelumnya";
    }
  }
  return hasil;
}

export interface BlastHari {
  tanggal: string;
  costChat: number;
  ongkir: number;
  promoHadiah: number;
  promoCb: number;
  freeProduk: number;
  spend: number;
  data: number;
  closing: number;
  box: number;
  omset: number;
}

/** Blast harian satu bulan; `produk` null = semua produk dijumlah. */
export async function blastHarian(bulan: string, produk: string | null): Promise<BlastHari[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT DATE_FORMAT(tanggal, '%Y-%m-%d') AS tgl,
            COALESCE(SUM(cost_chat), 0) AS cost_chat, COALESCE(SUM(ongkir), 0) AS ongkir,
            COALESCE(SUM(promo_hadiah), 0) AS promo_hadiah, COALESCE(SUM(promo_cb), 0) AS promo_cb,
            COALESCE(SUM(free_produk), 0) AS free_produk, COALESCE(SUM(spend_total), 0) AS spend,
            COALESCE(SUM(data), 0) AS data_, COALESCE(SUM(closing), 0) AS closing,
            COALESCE(SUM(box), 0) AS box, COALESCE(SUM(omset), 0) AS omset
       FROM data_crm_blast
      WHERE DATE_FORMAT(tanggal, '%Y-%m') = ? ${produk ? "AND produk = ?" : ""}
      GROUP BY tanggal
      ORDER BY tanggal`,
    produk ? [bulan, produk] : [bulan],
  );
  return rows.map((r) => ({
    tanggal: String(r.tgl),
    costChat: n(r.cost_chat),
    ongkir: n(r.ongkir),
    promoHadiah: n(r.promo_hadiah),
    promoCb: n(r.promo_cb),
    freeProduk: n(r.free_produk),
    spend: n(r.spend),
    data: n(r.data_),
    closing: n(r.closing),
    box: n(r.box),
    omset: n(r.omset),
  }));
}

/* ------------------------------------------------------------ RO */

export interface RoBulan {
  bulan: string;
  produk: string;
  closing: number;
  box: number;
}

/** Total RO (semua CS & segmen) per bulan per produk. */
export async function roBulanan(): Promise<RoBulan[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT DATE_FORMAT(tanggal, '%Y-%m') AS bln, produk,
            COALESCE(SUM(closing), 0) AS closing, COALESCE(SUM(box), 0) AS box
       FROM data_crm_ro
      GROUP BY DATE_FORMAT(tanggal, '%Y-%m'), produk
      ORDER BY bln, produk`,
  );
  return rows.map((r) => ({ bulan: String(r.bln), produk: String(r.produk), closing: n(r.closing), box: n(r.box) }));
}

export interface RoCs {
  cs: string;
  segmen: string;
  closing: number;
  box: number;
}

/** RO per CS per segmen dalam satu bulan. */
export async function roPerCs(bulan: string, produk: string | null): Promise<RoCs[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT cs, segmen, COALESCE(SUM(closing), 0) AS closing, COALESCE(SUM(box), 0) AS box
       FROM data_crm_ro
      WHERE DATE_FORMAT(tanggal, '%Y-%m') = ? ${produk ? "AND produk = ?" : ""}
      GROUP BY cs, segmen
      ORDER BY cs, segmen`,
    produk ? [bulan, produk] : [bulan],
  );
  return rows.map((r) => ({ cs: String(r.cs), segmen: String(r.segmen), closing: n(r.closing), box: n(r.box) }));
}

/* ------------------------------------------------------------ CS */

export interface CsRingkas {
  /** CS (ringkasan per CS) atau sumber (rincian satu CS). */
  nama: string;
  leadForm: number;
  leadWa: number;
  leadLain: number;
  closing: number;
  box: number;
  closingFu: number;
  boxFu: number;
}

const KOLOM_CS = `COALESCE(SUM(lead_form), 0) AS lead_form, COALESCE(SUM(lead_wa), 0) AS lead_wa,
            COALESCE(SUM(lead_lain), 0) AS lead_lain, COALESCE(SUM(closing), 0) AS closing,
            COALESCE(SUM(box), 0) AS box, COALESCE(SUM(closing_fu), 0) AS closing_fu,
            COALESCE(SUM(box_fu), 0) AS box_fu`;

function keCs(r: Record<string, unknown>): CsRingkas {
  return {
    nama: String(r.nama),
    leadForm: n(r.lead_form),
    leadWa: n(r.lead_wa),
    leadLain: n(r.lead_lain),
    closing: n(r.closing),
    box: n(r.box),
    closingFu: n(r.closing_fu),
    boxFu: n(r.box_fu),
  };
}

/**
 * Per CS (cs = null) atau per sumber untuk satu CS. `jenis` AKUISISI /
 * CRM; `produk` null = semua produk.
 */
export async function csRingkas(
  bulan: string,
  jenis: string,
  produk: string | null,
  cs: string | null,
): Promise<CsRingkas[]> {
  const params: string[] = [bulan, jenis];
  if (produk) params.push(produk);
  if (cs) params.push(cs);
  const kelompok = cs ? "sumber" : "cs";
  const rows = await query<Record<string, unknown>>(
    `SELECT ${kelompok} AS nama, ${KOLOM_CS}
       FROM data_crm_cs
      WHERE DATE_FORMAT(tanggal, '%Y-%m') = ? AND jenis_cs = ?
        ${produk ? "AND produk = ?" : ""} ${cs ? "AND cs = ?" : ""}
      GROUP BY ${kelompok}
      ORDER BY box DESC`,
    params,
  );
  return rows.map(keCs);
}

/** Bulan yang punya data di salah satu tabel CRM, terbaru dulu. */
export async function bulanCrm(): Promise<string[]> {
  const rows = await query<{ bln: string }>(
    `SELECT DISTINCT bln FROM (
       SELECT DATE_FORMAT(tanggal, '%Y-%m') AS bln FROM data_crm_ro
       UNION SELECT DATE_FORMAT(tanggal, '%Y-%m') FROM data_crm_cs
       UNION SELECT DATE_FORMAT(tanggal, '%Y-%m') FROM data_crm_blast) x
     ORDER BY bln DESC`,
  );
  return rows.map((r) => String(r.bln));
}

/** Produk yang muncul di tabel CRM. */
export async function produkCrm(): Promise<string[]> {
  const rows = await query<{ produk: string }>(
    `SELECT DISTINCT produk FROM (
       SELECT produk FROM data_crm_ro UNION SELECT produk FROM data_crm_cs
       UNION SELECT produk FROM data_crm_blast) x
     ORDER BY FIELD(produk, 'Gamamilk', 'Gamamilk Premium', 'Gamamilk Plus', 'Gamamilk Sereal'), produk`,
  );
  return rows.map((r) => String(r.produk));
}
