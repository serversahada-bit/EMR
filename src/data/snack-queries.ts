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
 * Snack Video — sumbernya ditemukan dari katalog database.
 *
 * Saat halaman ini dibuat belum ada satu pun tabel `data_spend_snack…`;
 * sumbernya dibaca dari `information_schema`, jadi halaman langsung
 * terisi begitu tabelnya dibuat tanpa mengubah kode. Di file Progres,
 * datanya ada di sheet berakhiran "(SNACK)" — mis. `ADV GUSTI (SNACK)`,
 * `ADV PUTRA (SNACK)` — dengan banner `SNACKVIDEO GAMAMILK`.
 */
const SNACK: KanalSpend = {
  prefix: "data_spend_snack",
  /** Semua tahun ditampilkan; Snack belum punya data yang perlu dibatasi. */
  tahunAktif: [],
};

export type SnackSource = SumberKanal;
export type SnackSourceMonth = BulanSumber;
export type SpendHarianSnack = SpendHarianKanal;

export function snackSources(): Promise<SnackSource[]> {
  return sumberKanal(SNACK);
}

export function snackSourceMonths(): Promise<{
  sources: SnackSource[];
  months: SnackSourceMonth[];
}> {
  return bulanSumberKanal(SNACK);
}

export function snackBulanSumber(sourceId: string): Promise<string[]> {
  return bulanSatuSumber(SNACK, sourceId);
}

export function snackSpendHarian(
  sourceId: string,
  bulan: string,
): Promise<SpendHarianSnack[]> {
  return spendHarianKanal(SNACK, sourceId, bulan);
}
