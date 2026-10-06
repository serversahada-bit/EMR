/* ──────────────────────────────────────────────────────────────
   DATA CONTOH (DUMMY) — bukan angka riil.
   Satu-satunya file yang perlu Anda ganti saat data asli tersedia.
   Lihat src/data/README.md untuk cara menukarnya.
   ────────────────────────────────────────────────────────────── */

import type {
  AdsMonthFact,
  Campaign,
  Division,
  DivisionMonthFact,
  Initiative,
  ReportSource,
} from "./types";

/**
 * 24 bulan: Okt 2024 – Sep 2026 (cut-off 30 Sep 2026).
 * Dua tahun diperlukan agar setiap preset periode punya rentang
 * pembanding dengan panjang yang sama (delta pada kartu KPI).
 */
const MONTH_KEYS = [
  "2024-10", "2024-11", "2024-12",
  "2025-01", "2025-02", "2025-03",
  "2025-04", "2025-05", "2025-06",
  "2025-07", "2025-08", "2025-09",
  "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02", "2026-03",
  "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09",
];

const DIVISIONS: Division[] = [
  { id: "korporat", name: "Korporat & Enterprise", short: "Korporat", lead: "A. Nugroho" },
  { id: "ritel", name: "Ritel & Konsumer", short: "Ritel", lead: "S. Widodo" },
  { id: "distribusi", name: "Distribusi & Logistik", short: "Distribusi", lead: "M. Hartono" },
  { id: "digital", name: "Layanan Digital", short: "Digital", lead: "R. Pramudya" },
  { id: "proyek", name: "Proyek & Konstruksi", short: "Proyek", lead: "D. Sihombing" },
];

const M = 1_000_000_000; // satu miliar rupiah

interface Profile {
  id: string;
  /** Pendapatan bulan pertama. */
  base: number;
  /** Pertumbuhan bulanan realisasi. */
  growth: number;
  /** Pertumbuhan bulanan target (RKAP disusun lebih optimistis). */
  targetGrowth: number;
  /** Target bulan pertama relatif base. */
  targetBias: number;
  /** Volatilitas realisasi (0 = mulus). */
  noise: number;
  cogsRatio: number;
  marketingRatio: number;
  /** Beban pegawai & opex bersifat tetap, tidak ikut pendapatan. */
  payrollFixed: number;
  opexFixed: number;
  otherFixed: number;
  headcount: number;
  headcountGrowth: number;
}

const PROFILES: Profile[] = [
  {
    id: "korporat", base: 9.2 * M, growth: 0.009, targetGrowth: 0.011,
    targetBias: 1.04, noise: 0.035, cogsRatio: 0.52, marketingRatio: 0.045,
    payrollFixed: 1.42 * M, opexFixed: 0.52 * M, otherFixed: 0.24 * M,
    headcount: 214, headcountGrowth: 1.1,
  },
  {
    id: "ritel", base: 6.4 * M, growth: 0.014, targetGrowth: 0.013,
    targetBias: 1.02, noise: 0.055, cogsRatio: 0.615, marketingRatio: 0.085,
    payrollFixed: 1.08 * M, opexFixed: 0.63 * M, otherFixed: 0.19 * M,
    headcount: 386, headcountGrowth: 2.4,
  },
  {
    id: "distribusi", base: 4.8 * M, growth: 0.005, targetGrowth: 0.009,
    targetBias: 1.06, noise: 0.04, cogsRatio: 0.69, marketingRatio: 0.025,
    payrollFixed: 0.74 * M, opexFixed: 0.41 * M, otherFixed: 0.12 * M,
    headcount: 268, headcountGrowth: -0.8,
  },
  {
    id: "digital", base: 2.1 * M, growth: 0.028, targetGrowth: 0.022,
    targetBias: 0.98, noise: 0.06, cogsRatio: 0.33, marketingRatio: 0.12,
    payrollFixed: 0.61 * M, opexFixed: 0.22 * M, otherFixed: 0.07 * M,
    headcount: 96, headcountGrowth: 2.6,
  },
  {
    id: "proyek", base: 3.6 * M, growth: 0.004, targetGrowth: 0.013,
    targetBias: 1.12, noise: 0.14, cogsRatio: 0.72, marketingRatio: 0.02,
    payrollFixed: 0.58 * M, opexFixed: 0.31 * M, otherFixed: 0.11 * M,
    headcount: 142, headcountGrowth: -0.4,
  },
];

/** Musiman: Lebaran (Mar–Apr) dan akhir tahun naik, Januari turun. */
const SEASON: Record<number, number> = {
  1: 0.92, 2: 0.95, 3: 1.08, 4: 1.06, 5: 1.0, 6: 1.02,
  7: 1.03, 8: 1.01, 9: 1.04, 10: 1.02, 11: 1.05, 12: 1.12,
};

/** PRNG deterministik — angka contoh selalu sama di tiap build. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function buildFacts(): DivisionMonthFact[] {
  const facts: DivisionMonthFact[] = [];

  PROFILES.forEach((profile, divisionIndex) => {
    const rand = makeRandom(7_919 + divisionIndex * 1_237);

    MONTH_KEYS.forEach((month, i) => {
      const calendarMonth = Number(month.slice(5, 7));
      const season = SEASON[calendarMonth];
      const jitter = 1 + (rand() - 0.5) * 2 * profile.noise;

      const revenue =
        profile.base * Math.pow(1 + profile.growth, i) * season * jitter;
      const target =
        profile.base *
        profile.targetBias *
        Math.pow(1 + profile.targetGrowth, i) *
        season;

      const headcount = Math.round(
        profile.headcount + profile.headcountGrowth * i,
      );
      const payrollScale = headcount / profile.headcount;

      const cogs = revenue * profile.cogsRatio * (1 + (rand() - 0.5) * 0.03);
      const payroll = profile.payrollFixed * payrollScale;
      const marketing = revenue * profile.marketingRatio;
      const opex = profile.opexFixed * (1 + (rand() - 0.5) * 0.08);
      const otherCost = profile.otherFixed * (1 + (rand() - 0.5) * 0.1);

      const totalCost = cogs + payroll + marketing + opex + otherCost;
      /* Penagihan tertinggal/mendahului sedikit dari pengakuan pendapatan. */
      const cashIn = revenue * (0.9 + rand() * 0.16);
      /* Belanja modal menumpuk di Desember dan Juni. */
      const capex = calendarMonth === 12 || calendarMonth === 6
        ? revenue * 0.05
        : 0;
      const cashOut = totalCost * (0.94 + rand() * 0.08) + capex;

      facts.push({
        month,
        divisionId: profile.id,
        revenue: round(revenue),
        target: round(target),
        cogs: round(cogs),
        payroll: round(payroll),
        marketing: round(marketing),
        opex: round(opex),
        otherCost: round(otherCost),
        cashIn: round(cashIn),
        cashOut: round(cashOut),
        headcount,
      });
    });
  });

  return facts;
}

function round(value: number): number {
  return Math.round(value / 1_000_000) * 1_000_000;
}

const INITIATIVES: Initiative[] = [
  {
    id: "init-1",
    name: "Implementasi ERP fase 2",
    owner: "R. Pramudya",
    divisionId: "digital",
    progress: 78,
    status: "good",
    due: "Des 2026",
    note: "Modul keuangan dan pengadaan sudah live di tiga entitas.",
  },
  {
    id: "init-2",
    name: "Efisiensi biaya logistik 12%",
    owner: "M. Hartono",
    divisionId: "distribusi",
    progress: 54,
    status: "warning",
    due: "Q4 2026",
    note: "Renegosiasi tarif vendor tertunda, penghematan baru 6,4%.",
  },
  {
    id: "init-3",
    name: "Ekspansi 18 gerai regional",
    owner: "S. Widodo",
    divisionId: "ritel",
    progress: 61,
    status: "good",
    due: "Q1 2027",
    note: "11 gerai beroperasi, 7 dalam tahap fit-out.",
  },
  {
    id: "init-4",
    name: "Proyek infrastruktur Trans-Jawa",
    owner: "D. Sihombing",
    divisionId: "proyek",
    progress: 32,
    status: "critical",
    due: "Q2 2027",
    note: "Pembebasan lahan molor 5 bulan; eskalasi biaya Rp 14,2 M.",
  },
  {
    id: "init-5",
    name: "Program retensi talenta kunci",
    owner: "A. Nugroho",
    divisionId: "korporat",
    progress: 70,
    status: "good",
    due: "Berjalan",
    note: "Attrition turun dari 14,8% ke 9,6% secara tahunan.",
  },
  {
    id: "init-6",
    name: "Sertifikasi ISO 27001",
    owner: "R. Pramudya",
    divisionId: "digital",
    progress: 45,
    status: "serious",
    due: "Q3 2027",
    note: "Audit internal menemukan 9 temuan mayor yang perlu remediasi.",
  },
];


/* ──────────────────────────────────────────────────────────────
   Meta Ads
   Belanja iklan diturunkan dari komponen biaya "marketing" tiap
   divisi, jadi angkanya tidak bertabrakan dengan laporan biaya:
   belanja Meta selalu merupakan bagian dari beban pemasaran.
   ────────────────────────────────────────────────────────────── */

const CAMPAIGNS: Campaign[] = [
  {
    id: "cmp-retarget",
    name: "Retargeting Katalog Ritel",
    objective: "Konversi",
    divisionId: "ritel",
    status: "aktif",
  },
  {
    id: "cmp-prospect",
    name: "Prospecting Video Ritel",
    objective: "Jangkauan",
    divisionId: "ritel",
    status: "aktif",
  },
  {
    id: "cmp-lebaran",
    name: "Promo Lebaran Ritel",
    objective: "Konversi",
    divisionId: "ritel",
    status: "selesai",
  },
  {
    id: "cmp-leadgen",
    name: "Lead Gen Layanan Digital",
    objective: "Prospek",
    divisionId: "digital",
    status: "aktif",
  },
  {
    id: "cmp-awareness",
    name: "Awareness Brand Digital",
    objective: "Jangkauan",
    divisionId: "digital",
    status: "dijeda",
  },
  {
    id: "cmp-b2b",
    name: "Kampanye Korporat B2B",
    objective: "Prospek",
    divisionId: "korporat",
    status: "aktif",
  },
];

interface AdsProfile {
  campaignId: string;
  divisionId: string;
  /** Porsi belanja terhadap beban pemasaran divisi pada bulan itu. */
  budgetShare: number;
  /** Biaya per 1.000 tayangan (rupiah). */
  cpm: number;
  /** Rasio klik terhadap tayangan. */
  ctr: number;
  /** Rasio konversi terhadap klik. */
  cvr: number;
  /** Nilai rata-rata satu konversi (rupiah). */
  valuePerConversion: number;
  /** Tayangan dibagi jangkauan unik. */
  frequency: number;
  /** Bila diisi, kampanye hanya jalan pada bulan kalender ini. */
  activeMonths?: number[];
}

const ADS_PROFILES: AdsProfile[] = [
  {
    campaignId: "cmp-retarget", divisionId: "ritel", budgetShare: 0.2,
    cpm: 32_000, ctr: 0.021, cvr: 0.018, valuePerConversion: 420_000,
    frequency: 3.1,
  },
  {
    campaignId: "cmp-prospect", divisionId: "ritel", budgetShare: 0.18,
    cpm: 18_000, ctr: 0.009, cvr: 0.008, valuePerConversion: 380_000,
    frequency: 1.9,
  },
  {
    campaignId: "cmp-lebaran", divisionId: "ritel", budgetShare: 0.14,
    cpm: 38_000, ctr: 0.024, cvr: 0.016, valuePerConversion: 510_000,
    frequency: 2.6, activeMonths: [2, 3, 4],
  },
  {
    campaignId: "cmp-leadgen", divisionId: "digital", budgetShare: 0.28,
    cpm: 42_000, ctr: 0.014, cvr: 0.012, valuePerConversion: 900_000,
    frequency: 2.2,
  },
  {
    campaignId: "cmp-awareness", divisionId: "digital", budgetShare: 0.18,
    cpm: 15_000, ctr: 0.006, cvr: 0.004, valuePerConversion: 900_000,
    frequency: 1.7,
  },
  {
    campaignId: "cmp-b2b", divisionId: "korporat", budgetShare: 0.12,
    cpm: 55_000, ctr: 0.011, cvr: 0.004, valuePerConversion: 6_500_000,
    frequency: 2.4,
  },
];

function buildAdsFacts(facts: DivisionMonthFact[]): AdsMonthFact[] {
  const marketingByKey = new Map<string, number>();
  for (const fact of facts) {
    marketingByKey.set(fact.divisionId + "|" + fact.month, fact.marketing);
  }

  const rows: AdsMonthFact[] = [];

  ADS_PROFILES.forEach((profile, index) => {
    const rand = makeRandom(104_729 + index * 911);

    MONTH_KEYS.forEach((month) => {
      const calendarMonth = Number(month.slice(5, 7));
      if (profile.activeMonths && !profile.activeMonths.includes(calendarMonth)) {
        return;
      }

      const marketing = marketingByKey.get(profile.divisionId + "|" + month);
      if (!marketing) return;

      const spend = marketing * profile.budgetShare * (1 + (rand() - 0.5) * 0.18);
      const cpm = profile.cpm * (1 + (rand() - 0.5) * 0.22);
      const impressions = (spend / cpm) * 1000;
      const clicks = impressions * profile.ctr * (1 + (rand() - 0.5) * 0.25);
      const conversions = clicks * profile.cvr * (1 + (rand() - 0.5) * 0.3);
      const value =
        conversions * profile.valuePerConversion * (1 + (rand() - 0.5) * 0.2);

      rows.push({
        month,
        campaignId: profile.campaignId,
        spend: Math.round(spend / 1_000) * 1_000,
        impressions: Math.round(impressions),
        reach: Math.round(impressions / profile.frequency),
        clicks: Math.round(clicks),
        conversions: Math.round(conversions),
        conversionValue: Math.round(value / 1_000) * 1_000,
      });
    });
  });

  return rows;
}

const FACTS = buildFacts();

export const sampleSource: ReportSource = {
  meta: {
    company: "PT SLU",
    periodLabel: "Oktober 2024 – September 2026",
    asOf: "30 September 2026",
    preparedBy: "Divisi Perencanaan & Pengendalian Kinerja",
    currency: "IDR",
    isSampleData: true,
  },
  divisions: DIVISIONS,
  facts: FACTS,
  initiatives: INITIATIVES,
  campaigns: CAMPAIGNS,
  adsFacts: buildAdsFacts(FACTS),
};

export const MONTH_ORDER = MONTH_KEYS;
