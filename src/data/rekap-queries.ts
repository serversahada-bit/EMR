import "server-only";

import { query } from "./db";

/* ──────────────────────────────────────────────────────────────
   Rekap data tahunan — kanal yang datanya berasal dari impor file
   Progres (impor_progres.py), bukan dibaca realtime. Halaman induknya
   menampilkan tanggal data terakhir tiap kanal supaya ketahuan kapan
   impor terakhir dijalankan.
   ────────────────────────────────────────────────────────────── */

export type KanalRekap = "meta" | "google" | "snack" | "marketplace" | "crm" | "cos";

/**
 * Tanggal terakhir yang benar-benar ada belanjanya, per kanal.
 *
 * Dibatasi sampai hari ini: sebagian sheet sudah terisi untuk tanggal
 * yang belum terjadi (CRM blast s/d 30 Okt 2026 saat hari ini 26 Okt —
 * biaya tetap seperti langganan chat diisi di muka), dan tanggal itu
 * akan membuat data terlihat lebih baru dari kenyataannya.
 */
export async function tanggalTerakhirKanal(): Promise<Record<KanalRekap, string | null>> {
  /* [kanal, tabel, syarat "ada belanja"] — semua konstanta kode, bukan masukan. */
  const sumber: [KanalRekap, string, string][] = [
    ["meta", "data_spend_meta", "spend_iklan > 0"],
    ["google", "data_spend_google", "spend_iklan > 0"],
    ["snack", "data_spend_snack", "spend_iklan > 0"],
    ["marketplace", "data_spend_mp", "total_spend > 0"],
    ["crm", "data_crm_blast", "spend_total > 0"],
    /* COS: hanya pos nyata — kolom LAIN-LAIN berisi recehan di tanggal
       yang belum terjadi. */
    [
      "cos",
      "data_cos_harian",
      "jenis = 'DATA' AND COALESCE(spend_konversi, 0) + COALESCE(spend_mbc, 0) + COALESCE(spend_sales_promotion, 0) > 0",
    ],
  ];
  const hasil = await Promise.all(
    sumber.map(async ([kanal, tabel, syarat]) => {
      const [r] = await query<{ akhir: unknown }>(
        `SELECT MAX(tanggal) AS akhir FROM ${tabel}
          WHERE ${syarat} AND tanggal <= CURDATE()`,
      ).catch(() => [{ akhir: null }]);
      return [kanal, r?.akhir ? String(r.akhir).slice(0, 10) : null] as const;
    }),
  );
  return Object.fromEntries(hasil) as Record<KanalRekap, string | null>;
}
