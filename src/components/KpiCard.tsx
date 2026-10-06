"use client";

import type { ComponentType, SVGProps } from "react";
import { DeltaPill } from "./Pill";
import { Sparkline } from "./Sparkline";

/**
 * Kartu KPI: kotak ikon bertinta, label, nilai, lalu pil delta.
 * Nilai besar memakai angka proporsional (bukan tabular).
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  tint,
  color,
  delta,
  upIsGood = true,
  unit = "percent",
  comparison = "vs periode lalu",
  trend,
}: {
  label: string;
  value: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  tint: string;
  color: string;
  delta?: number | null;
  upIsGood?: boolean;
  unit?: "percent" | "pp";
  comparison?: string;
  trend?: number[];
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface px-5 py-4.5 shadow-[0_1px_2px_rgba(11,11,11,0.04)]">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: tint, color }}
        >
          <Icon size={18} />
        </span>
        <p className="truncate text-xs font-medium text-ink-2">{label}</p>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p
          className={
            /* Rupiah penuh bisa mencapai 16 karakter; tanpa penyesuaian ini
               angkanya meluber dan tinggi antar kartu jadi tidak seragam. */
            (value.length >= 15
              ? "text-[19px]"
              : value.length >= 12
                ? "text-[22px]"
                : "text-[26px]") +
            " font-semibold leading-none tracking-tight text-ink"
          }
        >
          {value}
        </p>
        {trend && trend.length > 1 ? <Sparkline values={trend} width={74} /> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DeltaPill value={delta ?? null} upIsGood={upIsGood} unit={unit} />
        <span className="text-[11px] text-muted">{comparison}</span>
      </div>
    </div>
  );
}
