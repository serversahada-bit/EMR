"use client";

import { useState } from "react";
import { barPath, niceScale, useMeasure } from "./chart-utils";
import { ChartTooltip } from "./Tooltip";
import type { Category } from "./LineChart";

/**
 * Polaritas di atas/di bawah garis nol → batang diverging.
 * Dua kutub yang terbaca berlawanan (biru ↔ merah) dengan titik
 * tengah netral; nilainya tetap pada satu sumbu.
 */
export function DivergingBarChart({
  categories,
  values,
  height = 200,
  formatValue,
  formatTick,
  seriesLabel,
}: {
  categories: Category[];
  values: number[];
  height?: number;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  seriesLabel: string;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const margin = { top: 16, right: 16, bottom: 26, left: 56 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = height;
  const svgH = plotH + margin.top + margin.bottom;

  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const scale = niceScale(min * 1.08, max * 1.08, 5);

  const band = categories.length ? plotW / categories.length : plotW;
  const barW = Math.min(24, band * 0.62);
  const bandCenter = (i: number) => margin.left + band * i + band / 2;
  const yAt = (value: number) =>
    margin.top +
    plotH -
    ((value - scale.min) / (scale.max - scale.min || 1)) * plotH;
  const zeroY = yAt(0);

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
          aria-label={"Grafik batang diverging: " + seriesLabel}
          className="block"
        >
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={margin.left + plotW}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke={tick === 0 ? "var(--axis)" : "var(--grid)"}
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

          {values.map((value, i) => {
            const positive = value >= 0;
            const top = positive ? yAt(value) : zeroY;
            const h = Math.abs(yAt(value) - zeroY);

            return (
              <path
                key={categories[i].longLabel}
                d={barPath(
                  bandCenter(i) - barW / 2,
                  top,
                  barW,
                  h,
                  4,
                  positive ? "top" : "bottom",
                )}
                fill={positive ? "var(--div-pos)" : "var(--div-neg)"}
                opacity={active === null || active === i ? 1 : 0.55}
              />
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
            {
              label: seriesLabel,
              value: formatValue(values[active]),
              color:
                values[active] >= 0 ? "var(--div-pos)" : "var(--div-neg)",
            },
          ]}
        />
      ) : null}
    </div>
  );
}
