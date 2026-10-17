import "server-only";

import {
  bulanSatuSumber,
  bulanSumberKanal,
  spendHarianKanal,
  sumberKanal,
  type BulanSumber,
  type KanalSpend,
  type SpendHarianKanal,
  type SumberKanal,
} from "./katalog-spend";

/**
 * Google Ads — sumbernya ditemukan dari katalog database.
 *
 * Seluruh logikanya ada di `katalog-spend`, dipakai bersama dengan Snack
 * Video; di sini hanya awalan tabel dan tahun yang ditampilkan.
 */
const GOOGLE: KanalSpend = {
  prefix: "data_spend_google",
  /**
   * Semua tahun ditampilkan.
   *
   * Sebelumnya dibatasi ke [2026], dan itu menyembunyikan 1.291 baris
   * senilai Rp4,46 miliar yang sudah ada di database — justru bagian
   * terbesar Google: utama 2024 & 2025, premium 2025, dan Etacefit 2024.
   * Isi array ini lagi kalau suatu saat perlu dibatasi per tahun.
   */
  tahunAktif: [],
};

export type GoogleSource = SumberKanal;
export type GoogleSourceMonth = BulanSumber;
export type SpendHarianGoogle = SpendHarianKanal;

export function googleSources(): Promise<GoogleSource[]> {
  return sumberKanal(GOOGLE);
}

export function googleSourceMonths(): Promise<{
  sources: GoogleSource[];
  months: GoogleSourceMonth[];
}> {
  return bulanSumberKanal(GOOGLE);
}

export function googleBulanSumber(sourceId: string): Promise<string[]> {
  return bulanSatuSumber(GOOGLE, sourceId);
}

export function googleSpendHarian(
  sourceId: string,
  bulan: string,
): Promise<SpendHarianGoogle[]> {
  return spendHarianKanal(GOOGLE, sourceId, bulan);
}
