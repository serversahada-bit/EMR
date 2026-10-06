"use client";

import { useState } from "react";
import { barPath, niceScale, useMeasure } from "./chart-utils";
import { ChartTooltip } from "./Tooltip";
import type { Category } from "./LineChart";

export interface StackSeries {
  id: string;
  label: string;
  color: string;
  values: number[];
}

/** Bagian-terhadap-keseluruhan per periode: kolom bertumpuk,
 *  dipisah oleh celah permukaan 2px (bukan garis tepi). */
export function StackedBarChart({
  categories,
  series,
  height = 240,
  formatValue,
  formatTick,
  totalLabel = "Total",
}: {
  categories: Category[];
  series: StackSeries[];
  height?: number;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  totalLabel?: string;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const margin = { top: 16, right: 16, bottom: 26, left: 56 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = height;
  const svgH = plotH + margin.top + margin.bottom;

  const totals = categories.map((_, i) =>
    series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0),
  );
  const scale = niceScale(0, Math.max(...totals, 1) * 1.02, 5);

  const band = categories.length ? plotW / categories.length : plotW;
  const barW = Math.min(24, band * 0.62);
  const bandCenter = (i: number) => margin.left + band * i + band / 2;
  const yAt = (value: number) =>
    margin.top + plotH - (value / (scale.max || 1)) * plotH;

  const GAP = 2;

  function handleMove(event: React.MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - bounds.left) / band);
    setActive(Math.max(0, Math.min(categories.length - 1, index)));
  }

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 ? (
        <svg
          width={width}
          height={svgH}
          role="img"
          aria-label={"Kolom bertumpuk: " + series.map((s) => s.label).join(", ")}
          className="block"
        >
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={margin.left + plotW}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke="var(--grid)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={margin.left - 10}
                y={yAt(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="tnum"
                fontSize={11}
                fill="var(--ink-muted)"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}

          <line
            x1={margin.left}
            x2={margin.left + plotW}
            y1={margin.top + plotH}
            y2={margin.top + plotH}
            stroke="var(--axis)"
            strokeWidth={1}
            shapeRendering="crispEdges"
          />

          {categories.map((category, i) => (
            <text
              key={category.longLabel}
              x={bandCenter(i)}
              y={margin.top + plotH + 17}
              textAnchor="middle"
              fontSize={11}
              fill={active === i ? "var(--ink-2)" : "var(--ink-muted)"}
            >
              {category.label}
            </text>
          ))}

          {categories.map((category, i) => {
            const x = bandCenter(i) - barW / 2;
            let cursor = 0;

            return (
              <g
                key={category.longLabel}
                opacity={active === null || active === i ? 1 : 0.55}
              >
                {series.map((s, segmentIndex) => {
                  const value = s.values[i] ?? 0;
                  if (value <= 0) return null;

                  const yTop = yAt(cursor + value);
                  const yBottom = yAt(cursor);
                  cursor += value;

                  const isTop = segmentIndex === series.length - 1;
                  const rawH = yBottom - yTop;
                  const h = Math.max(0, rawH - (isTop ? 0 : GAP));

                  return (
                    <path
                      key={s.id}
                      d={barPath(x, yTop, barW, h, 4, isTop ? "top" : "none")}
                      fill={s.color}
                    />
                  );
                })}
              </g>
            );
          })}

          <rect
            x={margin.left}
            y={margin.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setActive(null)}
          />
        </svg>
      ) : (
        <div style={{ height: svgH }} />
      )}

      {active !== null && width > 0 ? (
        <ChartTooltip
          x={bandCenter(active)}
          y={margin.top + 8}
          containerWidth={width}
          title={categories[active].longLabel}
          rows={[
            ...series.map((s) => ({
              label: s.label,
              value: formatValue(s.values[active] ?? 0),
              color: s.color,
            })),
            ...(series.length > 1
              ? [{ label: totalLabel, value: formatValue(totals[active]) }]
              : []),
          ]}
        />
      ) : null}
    </div>
  );
}
