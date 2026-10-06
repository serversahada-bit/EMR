"use client";

import { useEffect, useRef, useState } from "react";

/** Mengukur lebar kontainer agar SVG dirender pada ukuran piksel asli —
 *  stroke 2px tetap 2px, tidak ikut melar seperti pada viewBox yang diskalakan. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));

    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

export interface Scale {
  min: number;
  max: number;
  ticks: number[];
}

/** Tick sumbu pada angka bulat (0 / 5.000 / 10.000), bukan hasil bagi mentah. */
export function niceScale(min: number, max: number, count = 5): Scale {
  if (min === max) {
    max = min === 0 ? 1 : min * 1.2;
  }

  const step = niceNum((max - min) / Math.max(1, count - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  for (let v = niceMin; v <= niceMax + step * 0.001; v += step) {
    ticks.push(Number(v.toFixed(decimals)));
  }

  return { min: niceMin, max: niceMax, ticks };
}

function niceNum(range: number, round: boolean): number {
  if (range <= 0) return 1;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);

  let nice: number;
  if (round) {
    nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  } else {
    nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  }

  return nice * Math.pow(10, exponent);
}

export type RoundedSide = "top" | "bottom" | "right" | "left" | "none";

/**
 * Batang dengan ujung-data membulat 4px dan sisi baseline tetap kotak.
 * Radius selalu dibatasi agar tidak pernah lebih besar dari batangnya.
 */
export function barPath(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  side: RoundedSide,
): string {
  if (w <= 0 || h <= 0) return "";

  const vertical = side === "top" || side === "bottom";
  const r = Math.max(0, Math.min(radius, vertical ? Math.min(h, w / 2) : Math.min(w, h / 2)));

  if (r === 0 || side === "none") {
    return `M${x},${y}h${w}v${h}h${-w}Z`;
  }

  switch (side) {
    case "top":
      return [
        `M${x},${y + h}`,
        `L${x},${y + r}`,
        `A${r},${r} 0 0 1 ${x + r},${y}`,
        `L${x + w - r},${y}`,
        `A${r},${r} 0 0 1 ${x + w},${y + r}`,
        `L${x + w},${y + h}`,
        "Z",
      ].join(" ");
    case "bottom":
      return [
        `M${x},${y}`,
        `L${x + w},${y}`,
        `L${x + w},${y + h - r}`,
        `A${r},${r} 0 0 1 ${x + w - r},${y + h}`,
        `L${x + r},${y + h}`,
        `A${r},${r} 0 0 1 ${x},${y + h - r}`,
        "Z",
      ].join(" ");
    case "right":
      return [
        `M${x},${y}`,
        `L${x + w - r},${y}`,
        `A${r},${r} 0 0 1 ${x + w},${y + r}`,
        `L${x + w},${y + h - r}`,
        `A${r},${r} 0 0 1 ${x + w - r},${y + h}`,
        `L${x},${y + h}`,
        "Z",
      ].join(" ");
    case "left":
      return [
        `M${x + w},${y}`,
        `L${x + r},${y}`,
        `A${r},${r} 0 0 0 ${x},${y + r}`,
        `L${x},${y + h - r}`,
        `A${r},${r} 0 0 0 ${x + r},${y + h}`,
        `L${x + w},${y + h}`,
        "Z",
      ].join(" ");
  }
}

/** Garis polyline halus (tanpa smoothing — tren bulanan dibaca apa adanya). */
export function linePath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

/** Palet seri — urutan slot tetap, diambil dari token CSS. */
export const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)"];
