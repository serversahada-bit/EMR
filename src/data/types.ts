/* ──────────────────────────────────────────────────────────────
   Kontrak data Executive Management Report.
   UI hanya bergantung pada tipe-tipe di file ini — sumber datanya
   (dummy / Excel / API) bisa ditukar tanpa menyentuh komponen.
   ────────────────────────────────────────────────────────────── */

/** Kunci bulan ISO, contoh "2026-09". Dipakai untuk sort & filter. */
export type MonthKey = string;

export interface Division {
  id: string;
  /** Nama tampil di tabel, legend, dan filter. */
  name: string;
  /** Label pendek untuk sumbu chart (maks ~10 karakter). */
  short: string;
  /** Penanggung jawab — tampil di tabel kinerja divisi. */
  lead: string;
}

/**
 * Satu baris fakta = satu divisi pada satu bulan.
 * Ini adalah grain terkecil; seluruh angka di dashboard diturunkan
 * dari agregasi baris-baris ini, sehingga filter periode/divisi
 * konsisten di semua chart.
 *
 * Semua nilai moneter dalam RUPIAH PENUH (bukan ribuan/juta).
 */
export interface DivisionMonthFact {
  month: MonthKey;
  divisionId: string;

  /** Pendapatan terealisasi. */
  revenue: number;
  /** Target pendapatan yang disetujui (RKAP/budget). */
  target: number;

  /* Struktur biaya — lima komponen, menjumlah jadi total biaya. */
  cogs: number;       // harga pokok penjualan
  payroll: number;    // beban pegawai
  marketing: number;  // pemasaran & penjualan
  opex: number;       // operasional (sewa, utilitas, IT)
  otherCost: number;  // umum & administrasi lainnya

  /* Arus kas */
  cashIn: number;
  cashOut: number;

  /** Jumlah pegawai pada akhir bulan (nilai titik, bukan akumulasi). */
  headcount: number;
}

export type InitiativeStatus = "good" | "warning" | "serious" | "critical";

export interface Initiative {
  id: string;
  name: string;
  owner: string;
  divisionId: string;
  /** Progres 0–100. */
  progress: number;
  status: InitiativeStatus;
  /** Target selesai, format "Q4 2026" atau "Des 2026". */
  due: string;
  /** Catatan singkat untuk direksi — satu kalimat. */
  note: string;
}

export type CampaignStatus = "aktif" | "dijeda" | "selesai";

export interface Campaign {
  id: string;
  name: string;
  /** Tujuan kampanye di Ads Manager: Konversi, Prospek, Jangkauan, dst. */
  objective: string;
  /** Divisi pemilik anggaran — membuat filter unit bisnis tetap berlaku. */
  divisionId: string;
  status: CampaignStatus;
}

/**
 * Satu baris = satu kampanye Meta pada satu bulan.
 * Nama field mengikuti kolom ekspor Meta Ads Manager agar pemetaan
 * dari CSV-nya lurus. Metrik turunan (CTR, CPC, CPM, CPA, ROAS,
 * frekuensi) TIDAK disimpan — semuanya dihitung di report.ts supaya
 * tidak ada dua versi angka yang bisa berselisih.
 */
export interface AdsMonthFact {
  month: MonthKey;
  campaignId: string;

  /** Amount spent — belanja iklan dalam rupiah penuh. */
  spend: number;
  impressions: number;
  /** Orang unik yang dijangkau; impressions / reach = frekuensi. */
  reach: number;
  clicks: number;
  /** Results: pembelian atau prospek, sesuai tujuan kampanye. */
  conversions: number;
  /** Conversion value — nilai konversi dalam rupiah penuh. */
  conversionValue: number;
}

export interface ReportMeta {
  company: string;
  /** Judul periode pelaporan, mis. "Januari – September 2026". */
  periodLabel: string;
  /** Tanggal cut-off data. */
  asOf: string;
  preparedBy: string;
  currency: string;
  /** true = angka contoh, dipakai untuk menampilkan banner di UI. */
  isSampleData: boolean;
}

export interface ReportSource {
  meta: ReportMeta;
  divisions: Division[];
  facts: DivisionMonthFact[];
  initiatives: Initiative[];
  campaigns: Campaign[];
  adsFacts: AdsMonthFact[];
}
