/* ──────────────────────────────────────────────────────────────
   Lapisan agregasi. Komponen UI memanggil fungsi di sini, tidak
   pernah menyentuh sumber data langsung.
   ────────────────────────────────────────────────────────────── */

import { sampleSource } from "./sample";
import type {
  AdsMonthFact,
  Campaign,
  Division,
  DivisionMonthFact,
  Initiative,
  MonthKey,
  ReportMeta,
  ReportSource,
} from "./types";

/* Tukar baris ini saat data asli siap (lihat README.md). */
const source: ReportSource = sampleSource;

export const meta: ReportMeta = source.meta;
export const divisions: Division[] = source.divisions;
export const initiatives: Initiative[] = source.initiatives;

const facts: DivisionMonthFact[] = source.facts;

export const campaigns: Campaign[] = source.campaigns;
const adsFacts: AdsMonthFact[] = source.adsFacts;

/** Semua bulan yang ada di data, urut naik. */
export const months: MonthKey[] = Array.from(
  new Set(facts.map((f) => f.month)),
).sort();

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const MONTH_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function monthShort(month: MonthKey): string {
  return MONTH_SHORT[Number(month.slice(5, 7)) - 1];
}

export function monthLong(month: MonthKey): string {
  return `${MONTH_LONG[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/* ── Periode ──────────────────────────────────────────────────── */

export interface Period {
  id: string;
  label: string;
  /** Deskripsi rentang untuk subjudul kartu. */
  caption: string;
  from: MonthKey;
  to: MonthKey;
}

const lastMonth = months[months.length - 1];
const currentYear = lastMonth.slice(0, 4);

function sliceFrom(count: number): MonthKey {
  return months[Math.max(0, months.length - count)];
}

export const periods: Period[] = [
  {
    id: "ytd",
    label: "Year to date",
    caption: `${monthLong(`${currentYear}-01`)} – ${monthLong(lastMonth)}`,
    from: `${currentYear}-01`,
    to: lastMonth,
  },
  {
    id: "q",
    label: "Kuartal berjalan",
    caption: `${monthLong(sliceFrom(3))} – ${monthLong(lastMonth)}`,
    from: sliceFrom(3),
    to: lastMonth,
  },
  {
    id: "h",
    label: "6 bulan terakhir",
    caption: `${monthLong(sliceFrom(6))} – ${monthLong(lastMonth)}`,
    from: sliceFrom(6),
    to: lastMonth,
  },
  {
    id: "all",
    label: "12 bulan terakhir",
    caption: `${monthLong(months[0])} – ${monthLong(lastMonth)}`,
    from: months[0],
    to: lastMonth,
  },
];

export function resolvePeriod(id: string): Period {
  return periods.find((p) => p.id === id) ?? periods[0];
}

/** Rentang sebelumnya dengan panjang sama — basis perhitungan delta. */
export function previousPeriod(period: Period): Period | null {
  const start = months.indexOf(period.from);
  const end = months.indexOf(period.to);
  const length = end - start + 1;
  const prevEnd = start - 1;
  const prevStart = prevEnd - length + 1;

  if (prevStart < 0) return null;

  return {
    id: `${period.id}-prev`,
    label: "Periode sebelumnya",
    caption: `${monthLong(months[prevStart])} – ${monthLong(months[prevEnd])}`,
    from: months[prevStart],
    to: months[prevEnd],
  };
}

/* ── Seleksi ──────────────────────────────────────────────────── */

export interface Selection {
  periodId: string;
  /** "all" = seluruh divisi. */
  divisionId: string;
}

export function selectFacts(
  period: Period,
  divisionId: string,
): DivisionMonthFact[] {
  return facts.filter(
    (f) =>
      f.month >= period.from &&
      f.month <= period.to &&
      (divisionId === "all" || f.divisionId === divisionId),
  );
}

/* ── Metrik turunan ───────────────────────────────────────────── */

export interface Metrics {
  revenue: number;
  target: number;
  cogs: number;
  payroll: number;
  marketing: number;
  opex: number;
  otherCost: number;
  totalCost: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
  achievement: number;
  /** Headcount akhir periode (nilai titik, bukan jumlah antar bulan). */
  headcount: number;
  /** Pendapatan per pegawai, disetahunkan dari rata-rata bulanan. */
  revenuePerHead: number;
}

export function computeMetrics(rows: DivisionMonthFact[]): Metrics {
  const sum = (pick: (f: DivisionMonthFact) => number) =>
    rows.reduce((acc, f) => acc + pick(f), 0);

  const revenue = sum((f) => f.revenue);
  const target = sum((f) => f.target);
  const cogs = sum((f) => f.cogs);
  const payroll = sum((f) => f.payroll);
  const marketing = sum((f) => f.marketing);
  const opex = sum((f) => f.opex);
  const otherCost = sum((f) => f.otherCost);
  const cashIn = sum((f) => f.cashIn);
  const cashOut = sum((f) => f.cashOut);

  const totalCost = cogs + payroll + marketing + opex + otherCost;
  const grossProfit = revenue - cogs;
  const netProfit = revenue - totalCost;

  const latest = rows.length
    ? rows.map((f) => f.month).sort().slice(-1)[0]
    : null;
  const headcount = latest
    ? rows.filter((f) => f.month === latest).reduce((a, f) => a + f.headcount, 0)
    : 0;
  const monthCount = new Set(rows.map((f) => f.month)).size || 1;

  return {
    revenue, target, cogs, payroll, marketing, opex, otherCost,
    totalCost, grossProfit, netProfit, cashIn, cashOut,
    grossMargin: revenue ? (grossProfit / revenue) * 100 : 0,
    netMargin: revenue ? (netProfit / revenue) * 100 : 0,
    netCashFlow: cashIn - cashOut,
    achievement: target ? (revenue / target) * 100 : 0,
    headcount,
    revenuePerHead: headcount ? (revenue / monthCount) * 12 / headcount : 0,
  };
}

/* ── Seri bulanan ─────────────────────────────────────────────── */

export interface MonthlyPoint extends Metrics {
  month: MonthKey;
  label: string;
  longLabel: string;
}

export function monthlySeries(rows: DivisionMonthFact[]): MonthlyPoint[] {
  const byMonth = new Map<MonthKey, DivisionMonthFact[]>();

  for (const fact of rows) {
    const bucket = byMonth.get(fact.month);
    if (bucket) bucket.push(fact);
    else byMonth.set(fact.month, [fact]);
  }

  return Array.from(byMonth.keys())
    .sort()
    .map((month) => ({
      month,
      label: monthShort(month),
      longLabel: monthLong(month),
      ...computeMetrics(byMonth.get(month)!),
    }));
}

/* ── Ringkasan per divisi ─────────────────────────────────────── */

export interface DivisionSummary extends Metrics {
  divisionId: string;
  name: string;
  short: string;
  lead: string;
  /** Porsi terhadap total pendapatan periode, dalam persen. */
  share: number;
}

export function divisionSummary(
  rows: DivisionMonthFact[],
): DivisionSummary[] {
  const total = rows.reduce((acc, f) => acc + f.revenue, 0);

  return divisions
    .map((division) => {
      const own = rows.filter((f) => f.divisionId === division.id);
      const metrics = computeMetrics(own);
      return {
        divisionId: division.id,
        name: division.name,
        short: division.short,
        lead: division.lead,
        share: total ? (metrics.revenue / total) * 100 : 0,
        ...metrics,
      };
    })
    .filter((row) => row.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
}


/* ── Meta Ads ─────────────────────────────────────────────────── */

export function selectAdsFacts(
  period: Period,
  divisionId: string,
): AdsMonthFact[] {
  const owned = new Set(
    campaigns
      .filter((c) => divisionId === "all" || c.divisionId === divisionId)
      .map((c) => c.id),
  );

  return adsFacts.filter(
    (f) =>
      f.month >= period.from &&
      f.month <= period.to &&
      owned.has(f.campaignId),
  );
}

export interface AdsMetrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  /** Klik per tayangan, persen. */
  ctr: number;
  /** Biaya per klik. */
  cpc: number;
  /** Biaya per 1.000 tayangan. */
  cpm: number;
  /** Biaya per konversi. */
  cpa: number;
  /** Nilai konversi dibagi belanja. */
  roas: number;
  /** Tayangan dibagi jangkauan. Lintas bulan nilainya perkiraan,
   *  karena jangkauan unik tidak bisa dijumlahkan begitu saja. */
  frequency: number;
}

export function computeAdsMetrics(rows: AdsMonthFact[]): AdsMetrics {
  const sum = (pick: (f: AdsMonthFact) => number) =>
    rows.reduce((acc, f) => acc + pick(f), 0);

  const spend = sum((f) => f.spend);
  const impressions = sum((f) => f.impressions);
  const reach = sum((f) => f.reach);
  const clicks = sum((f) => f.clicks);
  const conversions = sum((f) => f.conversions);
  const conversionValue = sum((f) => f.conversionValue);

  return {
    spend,
    impressions,
    reach,
    clicks,
    conversions,
    conversionValue,
    ctr: impressions ? (clicks / impressions) * 100 : 0,
    cpc: clicks ? spend / clicks : 0,
    cpm: impressions ? (spend / impressions) * 1000 : 0,
    cpa: conversions ? spend / conversions : 0,
    roas: spend ? conversionValue / spend : 0,
    frequency: reach ? impressions / reach : 0,
  };
}

export interface AdsMonthlyPoint extends AdsMetrics {
  month: MonthKey;
  label: string;
  longLabel: string;
}

export function adsMonthlySeries(rows: AdsMonthFact[]): AdsMonthlyPoint[] {
  const byMonth = new Map<MonthKey, AdsMonthFact[]>();

  for (const row of rows) {
    const bucket = byMonth.get(row.month);
    if (bucket) bucket.push(row);
    else byMonth.set(row.month, [row]);
  }

  return Array.from(byMonth.keys())
    .sort()
    .map((month) => ({
      month,
      label: monthShort(month),
      longLabel: monthLong(month),
      ...computeAdsMetrics(byMonth.get(month)!),
    }));
}

export interface CampaignSummary extends AdsMetrics {
  campaignId: string;
  name: string;
  objective: string;
  status: Campaign["status"];
  divisionId: string;
  /** Porsi belanja terhadap total belanja iklan periode, persen. */
  share: number;
}

export function campaignSummary(rows: AdsMonthFact[]): CampaignSummary[] {
  const totalSpend = rows.reduce((acc, f) => acc + f.spend, 0);

  return campaigns
    .map((campaign) => {
      const own = rows.filter((f) => f.campaignId === campaign.id);
      const metrics = computeAdsMetrics(own);
      return {
        campaignId: campaign.id,
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status,
        divisionId: campaign.divisionId,
        share: totalSpend ? (metrics.spend / totalSpend) * 100 : 0,
        ...metrics,
      };
    })
    .filter((row) => row.spend > 0)
    .sort((a, b) => b.spend - a.spend);
}

/** Perubahan relatif dalam persen; null bila pembanding tak tersedia. */
export function deltaPercent(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
