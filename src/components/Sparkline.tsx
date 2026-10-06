"use client";

import { linePath } from "./chart-utils";

/** Sparkline 12 titik: garis dalam abu de-emphasis, titik terkini dalam aksen. */
export function Sparkline({
  values,
  width = 92,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const padding = 4;

  const points = values.map((value, i) => ({
    x: padding + (i / (values.length - 1)) * (width - padding * 2),
    y: height - padding - ((value - min) / span) * (height - padding * 2),
  }));
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="overflow-visible"
    >
      <path
        d={linePath(points)}
        fill="none"
        stroke="var(--demph)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={4}
        fill="var(--s1)"
        stroke="var(--surface)"
        strokeWidth={2}
      />
    </svg>
  );
}
