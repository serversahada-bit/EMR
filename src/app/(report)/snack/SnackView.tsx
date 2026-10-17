"use client";

import {
  KanalRingkasView,
  type KanalRingkasData,
} from "@/components/KanalRingkasView";

/* Tata letaknya dipakai bersama dengan Google Ads; lihat KanalRingkasView. */
export type SnackReportData = KanalRingkasData;

export function SnackView({ data }: { data: SnackReportData }) {
  return (
    <KanalRingkasView
      data={data}
      kanal={{ nama: "Snack Video", kataTabel: "Snack" }}
    />
  );
}
