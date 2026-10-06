import type {
  DivisionSummary,
  Metrics,
  MonthlyPoint,
} from "@/data/report";
import type { InitiativeStatus } from "@/data/types";
import { formatIDR, formatPercent } from "./format";

/** Selisih poin persentase, bertanda, dengan koma desimal. */
function formatPoints(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return sign + Math.abs(value).toFixed(1).replace(".", ",");
}

export interface Insight {
  /** Judul temuan — satu frasa. */
  headline: string;
  /** Satu kalimat penjelas, seluruhnya diturunkan dari angka. */
  detail: string;
  tone: InitiativeStatus;
}

/**
 * Ringkasan eksekutif diturunkan dari angka yang sama dengan chart —
 * tidak ada klaim yang tidak bisa ditelusuri ke data.
 */
export function buildInsights(
  metrics: Metrics,
  series: MonthlyPoint[],
  byDivision: DivisionSummary[],
): Insight[] {
  const insights: Insight[] = [];

  /* 1. Pencapaian target pendapatan */
  const gap = metrics.revenue - metrics.target;
  insights.push({
    headline:
      metrics.achievement >= 100
        ? "Target pendapatan terlampaui"
        : metrics.achievement >= 95
          ? "Pendapatan mendekati target"
          : "Pendapatan di bawah target",
    detail:
      `Realisasi ${formatIDR(metrics.revenue)} terhadap target ` +
      `${formatIDR(metrics.target)} — ${formatPercent(metrics.achievement)} ` +
      `(${gap >= 0 ? "surplus" : "selisih"} ${formatIDR(Math.abs(gap))}).`,
    tone:
      metrics.achievement >= 100
        ? "good"
        : metrics.achievement >= 95
          ? "warning"
          : "critical",
  });

  /* 2. Kontributor terkuat dan terlemah terhadap target */
  if (byDivision.length >= 2) {
    const ranked = [...byDivision].sort((a, b) => b.achievement - a.achievement);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];

    insights.push({
      headline: `${best.name} memimpin pencapaian`,
      detail:
        `${best.name} mencapai ${formatPercent(best.achievement)} dari target ` +
        `dengan marjin bersih ${formatPercent(best.netMargin)}; ` +
        `${worst.name} tertinggal di ${formatPercent(worst.achievement)}.`,
      tone: worst.achievement < 90 ? "warning" : "good",
    });
  }

  /* 3. Arah marjin bersih antar bulan */
  if (series.length >= 2) {
    const first = series[0];
    const last = series[series.length - 1];
    const shift = last.netMargin - first.netMargin;

    insights.push({
      headline:
        shift >= 0.5
          ? "Marjin bersih membaik"
          : shift <= -0.5
            ? "Marjin bersih tergerus"
            : "Marjin bersih relatif stabil",
      detail:
        `Marjin bergerak dari ${formatPercent(first.netMargin)} (${first.label}) ` +
        `ke ${formatPercent(last.netMargin)} (${last.label}), ` +
        `selisih ${formatPoints(shift)} poin persentase.`,
      tone: shift <= -1.5 ? "serious" : shift < 0 ? "warning" : "good",
    });
  }

  /* 4. Kualitas arus kas */
  const negativeMonths = series.filter((point) => point.netCashFlow < 0);
  insights.push({
    headline:
      negativeMonths.length === 0
        ? "Arus kas bersih positif sepanjang periode"
        : `Arus kas negatif pada ${negativeMonths.length} bulan`,
    detail:
      negativeMonths.length === 0
        ? `Akumulasi arus kas bersih ${formatIDR(metrics.netCashFlow)} dari ` +
          `penerimaan ${formatIDR(metrics.cashIn)}.`
        : `Bulan defisit: ${negativeMonths.map((m) => m.label).join(", ")}. ` +
          `Akumulasi arus kas bersih ${formatIDR(metrics.netCashFlow)}.`,
    tone:
      metrics.netCashFlow < 0
        ? "critical"
        : negativeMonths.length > 1
          ? "warning"
          : "good",
  });

  /* 5. Komponen biaya dominan */
  const components: Array<[string, number]> = [
    ["Harga pokok penjualan", metrics.cogs],
    ["Beban pegawai", metrics.payroll],
    ["Pemasaran", metrics.marketing],
    ["Operasional", metrics.opex],
    ["Umum & administrasi", metrics.otherCost],
  ];
  const [topName, topValue] = components.sort((a, b) => b[1] - a[1])[0];

  insights.push({
    headline: `${topName} mendominasi struktur biaya`,
    detail:
      `${formatIDR(topValue)} atau ` +
      `${formatPercent((topValue / (metrics.totalCost || 1)) * 100)} dari total biaya ` +
      `${formatIDR(metrics.totalCost)}.`,
    tone: "good",
  });

  return insights;
}
