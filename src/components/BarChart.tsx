"use client";

import { useState } from "react";
import { barPath, niceScale, useMeasure } from "./chart-utils";

export interface BarRow {
  id: string;
  label: string;
  value: number;
}

/**
 * Perbandingan magnitudo antar kategori bernama panjang → batang horizontal.
 * Satu seri = satu warna (slot 1); panjang batang sudah mengkodekan nilainya,
 * jadi warna tidak dipakai ulang untuk hal yang sama.
 */
export function BarChart({
  rows,
  formatValue,
  labelWidth = 150,
}: {
  rows: BarRow[];
  formatValue: (value: number) => string;
  labelWidth?: number;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [active, setActive] = useState<string | null>(null);

  const rowHeight = 38;
  const barH = 20;
  const valueWidth = 84;
  const margin = { top: 4, right: valueWidth, bottom: 4, left: labelWidth };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const svgH = rows.length * rowHeight + margin.top + margin.bottom;

  const scale = niceScale(0, Math.max(...rows.map((r) => r.value), 1), 4);
  const lengthOf = (value: number) => (value / (scale.max || 1)) * plotW;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 ? (
        <svg width={width} height={svgH} role="img" aria-label="Grafik batang" className="block">
          {rows.map((row, i) => {
            const y = margin.top + i * rowHeight;
            const barY = y + (rowHeight - barH) / 2;
            const w = lengthOf(row.value);
            const dim = active !== null && active !== row.id;

            return (
              <g
                key={row.id}
                opacity={dim ? 0.5 : 1}
                onMouseEnter={() => setActive(row.id)}
                onMouseLeave={() => setActive(null)}
              >
                {/* Area tangkap setinggi baris penuh, jauh di atas 24px */}
                <rect
                  x={0}
                  y={y}
                  width={width}
                  height={rowHeight}
                  fill="transparent"
                />

                <text
                  x={margin.left - 12}
                  y={y + rowHeight / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={12}
                  fill="var(--ink-2)"
                >
                  {row.label}
                </text>

                <path
                  d={barPath(margin.left, barY, w, barH, 4, "right")}
                  fill="var(--s1)"
                />

                {/* Nilai di ujung batang — label langsung, tidak terpotong */}
                <text
                  x={margin.left + w + 10}
                  y={y + rowHeight / 2}
                  dominantBaseline="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--ink)"
                  className="tnum"
                >
                  {formatValue(row.value)}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <div style={{ height: svgH }} />
      )}
    </div>
  );
}
