/** Formatter angka — semua nilai moneter disimpan dalam rupiah penuh. */

const MILIAR = 1_000_000_000;
const JUTA = 1_000_000;

/** Rp 21,4 M · Rp 480,2 jt · Rp 12.500 — ringkas untuk tile & tooltip. */
export function formatIDR(value: number, digits = 1): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);

  if (abs >= MILIAR) {
    return `${sign}Rp ${nf(abs / MILIAR, digits)} M`;
  }
  if (abs >= JUTA) {
    return `${sign}Rp ${nf(abs / JUTA, digits)} jt`;
  }
  return `${sign}Rp ${nf(abs, 0)}`;
}

/**
 * Rp 1.025.696.137 — rupiah penuh tanpa pembulatan.
 *
 * Dipakai di kartu KPI karena bentuk ringkasnya menyembunyikan terlalu
 * banyak: "Rp 1,0 M" bisa berarti apa saja antara 950 juta dan 1,05
 * miliar, sehingga angkanya tidak bisa dicocokkan dengan sumber data.
 */
export function formatIDRPenuh(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}Rp ${nf(Math.abs(value), 0)}`;
}

/** Varian tanpa prefix "Rp" — untuk tick sumbu yang sudah berjudul satuan. */
export function formatCompact(value: number, digits = 1): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);

  if (abs >= MILIAR) return `${sign}${nf(abs / MILIAR, digits)} M`;
  if (abs >= JUTA) return `${sign}${nf(abs / JUTA, digits)} jt`;
  if (abs === 0) return "0";
  return `${sign}${nf(abs, 0)}`;
}

/** 1.284 — ribuan dengan titik sesuai kaidah Indonesia. */
export function formatNumber(value: number, digits = 0): string {
  return nf(value, digits);
}

/** 4,4 jt · 92,5 rb · 1.665 — jumlah non-moneter yang ringkas. */
export function formatCount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return nf(value / 1_000_000, 1) + " jt";
  if (abs >= 10_000) return nf(value / 1_000, 1) + " rb";
  return nf(value, 0);
}

/** 4,96× — pengali seperti ROAS. */
export function formatMultiple(value: number, digits = 2): string {
  return nf(value, digits) + "×";
}

/** 18,4% */
export function formatPercent(value: number, digits = 1): string {
  return `${nf(value, digits)}%`;
}

/** +12,4% / −3,1% — delta selalu bertanda. */
export function formatDelta(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${nf(Math.abs(value), digits)}%`;
}

function nf(value: number, digits: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
