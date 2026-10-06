import { CampaignPill } from "./Pill";
import { Meter } from "./Meter";
import type { Column } from "./DataTable";
import type {
  AdsMonthlyPoint,
  CampaignSummary,
  DivisionSummary,
  MonthlyPoint,
} from "@/data/report";
import {
  formatCount,
  formatIDR,
  formatMultiple,
  formatNumber,
  formatPercent,
} from "@/lib/format";

/* Definisi kolom untuk kembar tabel tiap grafik. Dipakai lintas
   halaman, jadi tinggal satu tempat kalau formatnya berubah. */

export const revenueColumns: Column<MonthlyPoint>[] = [
  { key: "month", header: "Bulan", render: (r) => r.longLabel },
  {
    key: "revenue",
    header: "Realisasi",
    numeric: true,
    render: (r) => formatIDR(r.revenue),
  },
  {
    key: "target",
    header: "Target",
    numeric: true,
    render: (r) => formatIDR(r.target),
  },
  {
    key: "achievement",
    header: "Pencapaian",
    numeric: true,
    render: (r) => formatPercent(r.achievement),
  },
  {
    key: "gap",
    header: "Selisih",
    numeric: true,
    render: (r) => (
      <span
        style={{
          color:
            r.revenue >= r.target ? "var(--delta-up)" : "var(--delta-down)",
        }}
      >
        {r.revenue >= r.target ? "+" : "−"}
        {formatIDR(Math.abs(r.revenue - r.target))}
      </span>
    ),
  },
];

export const costColumns: Column<MonthlyPoint>[] = [
  { key: "month", header: "Bulan", render: (r) => r.label },
  { key: "cogs", header: "HPP", numeric: true, render: (r) => formatIDR(r.cogs) },
  {
    key: "payroll",
    header: "Pegawai",
    numeric: true,
    render: (r) => formatIDR(r.payroll),
  },
  {
    key: "marketing",
    header: "Pemasaran",
    numeric: true,
    render: (r) => formatIDR(r.marketing),
  },
  {
    key: "opex",
    header: "Operasional",
    numeric: true,
    render: (r) => formatIDR(r.opex),
  },
  {
    key: "otherCost",
    header: "Umum & adm.",
    numeric: true,
    render: (r) => formatIDR(r.otherCost),
  },
  {
    key: "total",
    header: "Total",
    numeric: true,
    render: (r) => (
      <span className="font-semibold">{formatIDR(r.totalCost)}</span>
    ),
  },
];

export const marginColumns: Column<MonthlyPoint>[] = [
  { key: "month", header: "Bulan", render: (r) => r.longLabel },
  {
    key: "gross",
    header: "Marjin kotor",
    numeric: true,
    render: (r) => formatPercent(r.grossMargin),
  },
  {
    key: "net",
    header: "Marjin bersih",
    numeric: true,
    render: (r) => formatPercent(r.netMargin),
  },
  {
    key: "profit",
    header: "Laba bersih",
    numeric: true,
    render: (r) => formatIDR(r.netProfit),
  },
];

export const cashColumns: Column<MonthlyPoint>[] = [
  { key: "month", header: "Bulan", render: (r) => r.longLabel },
  {
    key: "in",
    header: "Penerimaan",
    numeric: true,
    render: (r) => formatIDR(r.cashIn),
  },
  {
    key: "out",
    header: "Pengeluaran",
    numeric: true,
    render: (r) => formatIDR(r.cashOut),
  },
  {
    key: "net",
    header: "Arus kas bersih",
    numeric: true,
    render: (r) => (
      <span
        style={{
          color:
            r.netCashFlow >= 0 ? "var(--delta-up)" : "var(--delta-down)",
        }}
      >
        {formatIDR(r.netCashFlow)}
      </span>
    ),
  },
];

export const divisionColumns: Column<DivisionSummary>[] = [
  {
    key: "name",
    header: "Divisi",
    render: (r) => (
      <div className="min-w-[180px]">
        <p className="font-medium text-ink">{r.name}</p>
        <p className="mt-0.5 text-xs text-muted">PIC: {r.lead}</p>
      </div>
    ),
  },
  {
    key: "revenue",
    header: "Omset",
    numeric: true,
    render: (r) => formatIDR(r.revenue),
  },
  {
    key: "target",
    header: "Target",
    numeric: true,
    render: (r) => formatIDR(r.target),
  },
  {
    key: "achievement",
    header: "Pencapaian",
    render: (r) => (
      <div className="w-32">
        <Meter ratio={r.achievement} valueLabel={formatPercent(r.achievement)} />
      </div>
    ),
  },
  {
    key: "netProfit",
    header: "Laba bersih",
    numeric: true,
    render: (r) => formatIDR(r.netProfit),
  },
  {
    key: "netMargin",
    header: "Marjin bersih",
    numeric: true,
    render: (r) => formatPercent(r.netMargin),
  },
  {
    key: "share",
    header: "Porsi",
    numeric: true,
    render: (r) => formatPercent(r.share),
  },
  {
    key: "headcount",
    header: "Pegawai",
    numeric: true,
    render: (r) => formatNumber(r.headcount),
  },
];

export const adsMonthColumns: Column<AdsMonthlyPoint>[] = [
  { key: "month", header: "Bulan", render: (r) => r.longLabel },
  {
    key: "spend",
    header: "Belanja",
    numeric: true,
    render: (r) => formatIDR(r.spend),
  },
  {
    key: "impressions",
    header: "Tayangan",
    numeric: true,
    render: (r) => formatCount(r.impressions),
  },
  {
    key: "clicks",
    header: "Klik",
    numeric: true,
    render: (r) => formatCount(r.clicks),
  },
  {
    key: "ctr",
    header: "CTR",
    numeric: true,
    render: (r) => formatPercent(r.ctr, 2),
  },
  {
    key: "conversions",
    header: "Konversi",
    numeric: true,
    render: (r) => formatCount(r.conversions),
  },
  {
    key: "value",
    header: "Nilai konversi",
    numeric: true,
    render: (r) => formatIDR(r.conversionValue),
  },
  {
    key: "roas",
    header: "ROAS",
    numeric: true,
    render: (r) => (
      <span className="font-semibold">{formatMultiple(r.roas)}</span>
    ),
  },
];

export const roasColumns: Column<AdsMonthlyPoint>[] = [
  { key: "month", header: "Bulan", render: (r) => r.longLabel },
  {
    key: "spend",
    header: "Belanja",
    numeric: true,
    render: (r) => formatIDR(r.spend),
  },
  {
    key: "value",
    header: "Nilai konversi",
    numeric: true,
    render: (r) => formatIDR(r.conversionValue),
  },
  {
    key: "cpa",
    header: "CPA",
    numeric: true,
    render: (r) => formatIDR(r.cpa),
  },
  {
    key: "roas",
    header: "ROAS",
    numeric: true,
    render: (r) => (
      <span
        style={{
          color: r.roas >= 1 ? "var(--delta-up)" : "var(--delta-down)",
        }}
      >
        {formatMultiple(r.roas)}
      </span>
    ),
  },
];

export const campaignColumns: Column<CampaignSummary>[] = [
  {
    key: "name",
    header: "Kampanye",
    render: (r) => (
      <div className="min-w-[180px]">
        <p className="font-medium text-ink">{r.name}</p>
        <p className="mt-0.5 text-xs text-muted">Tujuan: {r.objective}</p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <CampaignPill status={r.status} />,
  },
  {
    key: "spend",
    header: "Belanja",
    numeric: true,
    render: (r) => formatIDR(r.spend),
  },
  {
    key: "share",
    header: "Porsi",
    numeric: true,
    render: (r) => formatPercent(r.share, 0),
  },
  {
    key: "ctr",
    header: "CTR",
    numeric: true,
    render: (r) => formatPercent(r.ctr, 2),
  },
  {
    key: "conversions",
    header: "Konversi",
    numeric: true,
    render: (r) => formatCount(r.conversions),
  },
  {
    key: "cpa",
    header: "CPA",
    numeric: true,
    render: (r) => formatIDR(r.cpa),
  },
  {
    key: "roas",
    header: "ROAS",
    numeric: true,
    render: (r) => (
      <span
        className="font-semibold"
        style={{
          color: r.roas >= 1 ? "var(--delta-up)" : "var(--delta-down)",
        }}
      >
        {formatMultiple(r.roas)}
      </span>
    ),
  },
];
