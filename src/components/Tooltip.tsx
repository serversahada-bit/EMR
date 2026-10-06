"use client";

import type { ReactNode } from "react";

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

/** Tooltip melengkapi, bukan satu-satunya jalan membaca nilai —
 *  setiap angka juga tersedia di tampilan tabel. */
export function ChartTooltip({
  x,
  y,
  title,
  rows,
  containerWidth,
  children,
}: {
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
  containerWidth: number;
  children?: ReactNode;
}) {
  const width = 196;
  const flip = x + width + 16 > containerWidth;

  return (
    <div
      className="pointer-events-none absolute z-20 rounded-lg border border-hairline bg-surface px-3 py-2.5"
      style={{
        left: flip ? x - width - 12 : x + 12,
        top: Math.max(4, y - 12),
        width,
        boxShadow: "0 6px 20px rgba(11,11,11,0.1)",
      }}
    >
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-baseline justify-between gap-3 text-xs"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-ink-2">
              {row.color ? (
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
              ) : null}
              <span className="truncate">{row.label}</span>
            </span>
            <span className="tnum shrink-0 font-semibold text-ink">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}
