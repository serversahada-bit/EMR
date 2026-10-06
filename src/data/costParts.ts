/* Komponen biaya — slot warna kategorikal dalam urutan tetap.
   Maksimal lima; melebihi itu palet kategorikal tidak lagi valid. */

export const COST_PARTS = [
  { id: "cogs", label: "Harga pokok penjualan", short: "HPP", slot: 1 },
  { id: "payroll", label: "Beban pegawai", short: "Pegawai", slot: 2 },
  { id: "marketing", label: "Pemasaran", short: "Pemasaran", slot: 3 },
  { id: "opex", label: "Operasional", short: "Operasional", slot: 4 },
  { id: "otherCost", label: "Umum & administrasi", short: "Umum", slot: 5 },
] as const;
