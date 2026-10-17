"use client";

import {
  KanalRingkasView,
  type KanalRingkasData,
} from "@/components/KanalRingkasView";

/* Tata letaknya dipakai bersama dengan Snack Video; lihat KanalRingkasView. */
export type GoogleReportData = KanalRingkasData;

export function GoogleView({ data }: { data: GoogleReportData }) {
  return (
    <KanalRingkasView data={data} kanal={{ nama: "Google Ads", kataTabel: "Google" }} />
  );
}
