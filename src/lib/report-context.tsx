"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Chip } from "@/components/Pill";
import {
  adsMonthlySeries,
  campaignSummary,
  computeAdsMetrics,
  computeMetrics,
  deltaPercent,
  divisionSummary,
  divisions,
  initiatives,
  monthlySeries,
  previousPeriod,
  resolvePeriod,
  selectAdsFacts,
  selectFacts,
  type AdsMetrics,
  type AdsMonthlyPoint,
  type CampaignSummary,
  type DivisionSummary,
  type Metrics,
  type MonthlyPoint,
  type Period,
} from "@/data/report";
import type { Initiative } from "@/data/types";

interface ReportValue {
  /* Filter — satu sumber kebenaran untuk seluruh halaman. */
  periodId: string;
  setPeriodId: (id: string) => void;
  divisionId: string;
  setDivisionId: (id: string) => void;
  query: string;
  setQuery: (value: string) => void;

  /* Potongan data sesuai filter. */
  period: Period;
  metrics: Metrics;
  series: MonthlyPoint[];
  byDivision: DivisionSummary[];
  previousMetrics: Metrics | null;
  ads: AdsMetrics;
  adsSeries: AdsMonthlyPoint[];
  adsCampaigns: CampaignSummary[];
  previousAds: AdsMetrics | null;

  /* Turunan yang dipakai berulang di banyak halaman. */
  scopeLabel: string;
  matchedDivisions: DivisionSummary[];
  matchedInitiatives: Initiative[];
  matchedCampaigns: CampaignSummary[];
  /** Delta metrik keuangan terhadap periode sebelumnya. */
  d: (pick: (m: Metrics) => number) => number | null;
  /** Delta metrik iklan terhadap periode sebelumnya. */
  da: (pick: (m: AdsMetrics) => number) => number | null;
  periodChip: ReactNode;
}

const ReportContext = createContext<ReportValue | null>(null);

/**
 * Filter hidup di layout, bukan di masing-masing halaman, sehingga
 * pilihan periode dan unit bisnis bertahan saat berpindah menu.
 */
export function ReportProvider({ children }: { children: ReactNode }) {
  const [periodId, setPeriodId] = useState("ytd");
  const [divisionId, setDivisionId] = useState("all");
  const [query, setQuery] = useState("");

  const slice = useMemo(() => {
    const period = resolvePeriod(periodId);
    const rows = selectFacts(period, divisionId);
    const adsRows = selectAdsFacts(period, divisionId);
    const previous = previousPeriod(period);

    return {
      period,
      metrics: computeMetrics(rows),
      series: monthlySeries(rows),
      byDivision: divisionSummary(rows),
      previousMetrics: previous
        ? computeMetrics(selectFacts(previous, divisionId))
        : null,
      ads: computeAdsMetrics(adsRows),
      adsSeries: adsMonthlySeries(adsRows),
      adsCampaigns: campaignSummary(adsRows),
      previousAds: previous
        ? computeAdsMetrics(selectAdsFacts(previous, divisionId))
        : null,
    };
  }, [periodId, divisionId]);

  const value = useMemo<ReportValue>(() => {
    const needle = query.trim().toLowerCase();

    const matchedDivisions = needle
      ? slice.byDivision.filter((row) =>
          (row.name + " " + row.lead).toLowerCase().includes(needle),
        )
      : slice.byDivision;

    const matchedInitiatives = initiatives
      .filter((item) => divisionId === "all" || item.divisionId === divisionId)
      .filter((item) =>
        needle
          ? (item.name + " " + item.owner + " " + item.note)
              .toLowerCase()
              .includes(needle)
          : true,
      );

    const matchedCampaigns = needle
      ? slice.adsCampaigns.filter((row) =>
          (row.name + " " + row.objective).toLowerCase().includes(needle),
        )
      : slice.adsCampaigns;

    return {
      periodId,
      setPeriodId,
      divisionId,
      setDivisionId,
      query,
      setQuery,
      ...slice,
      scopeLabel:
        divisionId === "all"
          ? "Seluruh divisi"
          : (divisions.find((item) => item.id === divisionId)?.name ?? ""),
      matchedDivisions,
      matchedInitiatives,
      matchedCampaigns,
      d: (pick) =>
        slice.previousMetrics
          ? deltaPercent(pick(slice.metrics), pick(slice.previousMetrics))
          : null,
      da: (pick) =>
        slice.previousAds
          ? deltaPercent(pick(slice.ads), pick(slice.previousAds))
          : null,
      periodChip: <Chip>{slice.period.label}</Chip>,
    };
  }, [periodId, divisionId, query, slice]);

  return (
    <ReportContext.Provider value={value}>{children}</ReportContext.Provider>
  );
}

export function useReport(): ReportValue {
  const value = useContext(ReportContext);
  if (!value) {
    throw new Error("useReport harus dipakai di dalam ReportProvider");
  }
  return value;
}
