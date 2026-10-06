"use client";

import { useState } from "react";
import { linePath, niceScale, useMeasure } from "./chart-utils";
import { ChartTooltip } from "./Tooltip";

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  values: number[];
  /** Seri utama cerita ini — hanya seri ini yang diberi label langsung. */
  labelEnd?: boolean;
  /** Isian area 10% di bawah garis (hanya layak untuk seri tunggal). */
  area?: boolean;
}

export interface Category {
  label: string;
  longLabel: string;
}

export function LineChart({
  categories,
  series,
  height = 240,
  formatValue,
  formatTick,
  zeroBased = false,
}: {
  categories: Category[];
  series: LineSeries[];
  height?: number;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  zeroBased?: boolean;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const hasEndLabel = series.some((s) => s.labelEnd);
  const margin = { top: 16, right: hasEndLabel ? 74 : 16, bottom: 26, left: 56 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = height;
  const svgH = plotH + margin.top + margin.bottom;

  const allValues = series.flatMap((s) => s.values);
  const rawMin = allValues.length ? Math.min(...allValues) : 0;
  const rawMax = allValues.length ? Math.max(...allValues) : 1;
  const scale = niceScale(zeroBased ? 0 : rawMin * 0.96, rawMax * 1.02, 5);

  const xAt = (i: number) =>
    margin.left +
    (categories.length === 1 ? plotW / 2 : (i / (categories.length - 1)) * plotW);
  const yAt = (value: number) =>
    margin.top +
    plotH -
    ((value - scale.min) / (scale.max - scale.min || 1)) * plotH;

  /* Label ujung dilepas bila bertumpuk — tidak pernah ditumpuk paksa. */
  const endLabels = (() => {
    const placed: Array<{ series: LineSeries; y: number }> = [];

    for (const s of series) {
      if (!s.labelEnd || !s.values.length) continue;
      const y = yAt(s.values[s.values.length - 1]);
      if (placed.some((p) => Math.abs(p.y - y) < 15)) continue;
      placed.push({ series: s, y });
    }
    return placed;
  })();

  function handleMove(event: React.MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = plotW ? (event.clientX - bounds.left) / plotW : 0;
    const index = Math.round(ratio * (categories.length - 1));
    setActive(Math.max(0, Math.min(categories.length - 1, index)));
  }

  function handleKey(event: React.KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    setActive((prev) => {
      const next = (prev ?? 0) + step;
      return Math.max(0, Math.min(categories.length - 1, next));
    });
  }

  const seriesNames = series.map((s) => s.label).join(", ");

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 ? (
        <svg
          width={width}
          height={svgH}
          role="img"
          tabIndex={0}
          aria-label={"Grafik garis: " + seriesNames}
          onKeyDown={handleKey}
          onBlur={() => setActive(null)}
          className="block outline-none"
        >
          {/* Gridline: hairline, solid, satu langkah dari permukaan */}
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
              x={xAt(i)}
              y={margin.top + plotH + 17}
              textAnchor="middle"
              fontSize={11}
              fill="var(--ink-muted)"
            >
              {category.label}
            </text>
          ))}

          {active !== null ? (
            <line
              x1={xAt(active)}
              x2={xAt(active)}
              y1={margin.top}
              y2={margin.top + plotH}
              stroke="var(--axis)"
              strokeWidth={1}
            />
          ) : null}

          {series
            .filter((s) => s.area)
            .map((s) => {
              const points = s.values.map((value, i) => ({
                x: xAt(i),
                y: yAt(value),
              }));
              const base = margin.top + plotH;
              const close =
                " L" + xAt(s.values.length - 1) + "," + base +
                " L" + xAt(0) + "," + base + " Z";
              return (
                <path
                  key={s.id + "-area"}
                  d={linePath(points) + close}
                  fill={s.color}
                  opacity={0.1}
                />
              );
            })}

          {series.map((s) => (
            <path
              key={s.id}
              d={linePath(
                s.values.map((value, i) => ({ x: xAt(i), y: yAt(value) })),
              )}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Penanda titik aktif — cincin permukaan 2px agar tetap terbaca */}
          {active !== null
            ? series.map((s) => (
                <circle
                  key={s.id + "-dot"}
                  cx={xAt(active)}
                  cy={yAt(s.values[active])}
                  r={4.5}
                  fill={s.color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ))
            : null}

          {endLabels.map(({ series: s, y }) => (
            <text
              key={s.id + "-endlabel"}
              x={margin.left + plotW + 10}
              y={y}
              dominantBaseline="middle"
              fontSize={11}
              fontWeight={600}
              fill="var(--ink-2)"
              className="tnum"
            >
              {formatValue(s.values[s.values.length - 1])}
            </text>
          ))}

          {/* Lapisan hover: area tangkap penuh, bukan titik presisi */}
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
          x={xAt(active)}
          y={margin.top + 8}
          containerWidth={width}
          title={categories[active].longLabel}
          rows={series.map((s) => ({
            label: s.label,
            value: formatValue(s.values[active]),
            color: s.color,
          }))}
        />
      ) : null}
    </div>
  );
}
