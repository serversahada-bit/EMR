"use client";

import { useState } from "react";

import { barPath, linePath, niceScale, useMeasure } from "@/components/chart-utils";

/* Grafik versi CEO: huruf besar (≥14px), satu warna data (--s1), hijau/merah
   HANYA untuk status COS dan selalu disertai ikon + kata, label langsung di
   grafik, tidak ada grafik dua sumbu. Dipakai halaman /monitoring. */

const UKURAN = { label: 15, nilai: 15, sumbu: 13 };

const fmtJt = (v: number) =>
  Math.abs(v) >= 1e9
    ? `Rp ${(v / 1e9).toFixed(2).replace(".", ",")} M`
    : `Rp ${Math.round(v / 1e6).toLocaleString("id-ID")} jt`;
const fmtPersen = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")}%`;

/** Pil status COS: warna + ikon + kata (tidak bergantung warna saja). */
export function StatusCos({ cos, batas, besar = false }: { cos: number | null; batas: number | null; besar?: boolean }) {
  if (cos === null || !Number.isFinite(cos)) return <span className="text-muted">—</span>;
  if (batas === null) return <span className="font-semibold text-ink">{fmtPersen(cos)}</span>;
  const aman = cos <= batas;
  return (
    <span
      className={"inline-flex items-center gap-1.5 rounded-full font-semibold " + (besar ? "px-3 py-1 text-base" : "px-2.5 py-0.5 text-sm")}
      style={{ background: aman ? "var(--good-bg)" : "var(--critical-bg)", color: aman ? "var(--good-fg)" : "var(--critical-fg)" }}
    >
      <span aria-hidden>{aman ? "✓" : "✕"}</span>
      {aman ? "AMAN" : "LEWAT BATAS"}
    </span>
  );
}

function Tooltip({ x, y, teks }: { x: number; y: number; teks: string }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-[0_4px_14px_rgba(11,11,11,0.12)]"
      style={{ left: x, top: y - 8 }}
    >
      {teks}
    </div>
  );
}

/* ---------------------------------------------------------------- ① */

export interface BarisKontribusi {
  id: string;
  label: string;
  omset: number;
  persen: number;
}

/** Dari mana omset datang: batang horizontal, rupiah + % di ujung batang. */
export function BarKontribusi({ rows }: { rows: BarisKontribusi[] }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [aktif, setAktif] = useState<string | null>(null);
  const tinggiBaris = 52, tinggiBatang = 26, kiri = 110, kanan = 170;
  const plotW = Math.max(0, width - kiri - kanan);
  const maks = Math.max(...rows.map((r) => r.omset), 1);
  return (
    <div ref={ref} className="relative w-full">
      {width > 0 ? (
        <svg width={width} height={rows.length * tinggiBaris} role="img" aria-label="Omset per kanal">
          {rows.map((r, i) => {
            const y = i * tinggiBaris;
            const w = (r.omset / maks) * plotW;
            return (
              <g key={r.id} opacity={aktif && aktif !== r.id ? 0.45 : 1}
                 onMouseEnter={() => setAktif(r.id)} onMouseLeave={() => setAktif(null)}>
                <rect x={0} y={y} width={width} height={tinggiBaris} fill="transparent" />
                <text x={kiri - 14} y={y + tinggiBaris / 2} textAnchor="end" dominantBaseline="middle"
                      fontSize={UKURAN.label} fontWeight={600} fill="var(--ink)">{r.label}</text>
                <path d={barPath(kiri, y + (tinggiBaris - tinggiBatang) / 2, Math.max(w, 2), tinggiBatang, 4, "right")} fill="var(--s1)" />
                <text x={kiri + w + 12} y={y + tinggiBaris / 2} dominantBaseline="middle" fontSize={UKURAN.nilai} fill="var(--ink)">
                  <tspan fontWeight={700}>{fmtJt(r.omset)}</tspan>
                  <tspan fill="var(--ink-2)">{`  ·  ${fmtPersen(r.persen)}`}</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      ) : <div style={{ height: rows.length * tinggiBaris }} />}
    </div>
  );
}

/* ---------------------------------------------------------------- ② */

export interface BarisCos {
  id: string;
  label: string;
  cos: number;
  /** null = tidak ada batas → batang netral, tanpa status aman/lewat. */
  batas: number | null;
  /** "grup" = baris kelompok (tebal, ada `sub`); "anak" = kanal anggotanya. */
  jenis?: "grup" | "anak";
  /** Baris kedua kecil di bawah label, mis. "Meta + CRM". */
  sub?: string;
}

/**
 * COS per kanal terhadap batasnya. Hijau ≤ batas, merah > batas, plus ikon.
 * Sumbu dipotong di 2× batas terbesar supaya satu kanal ekstrem (META 150%+)
 * tidak membuat kanal lain tak terbaca; yang terpotong diberi tanda ▶.
 */
/**
 * COS per kelompok kanal dibanding batasnya, dengan kanal anggotanya di
 * bawah tiap kelompok. Sheet hanya memberi batas untuk KELOMPOK (SOSCOM =
 * Meta + CRM, E-commerce = Meta×Shopee + TikTok + MP), bukan per kanal —
 * jadi kanal anggota digambar netral, tanpa garis batas dan tanpa status.
 * Dulu baris tanpa batas otomatis berlabel "✓ aman" hijau; Meta 153% pun
 * tampak aman.
 */
export function BarCos({ rows }: { rows: BarisCos[] }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [aktif, setAktif] = useState<string | null>(null);
  const tinggi = (r: BarisCos) => (r.jenis === "anak" ? 40 : 56);
  const ys = rows.reduce<number[]>((a, r, i) => [...a, i === 0 ? 0 : a[i - 1] + tinggi(rows[i - 1])], []);
  const total = rows.reduce((a, r) => a + tinggi(r), 0);
  const kiri = 190, kanan = 170;
  const plotW = Math.max(0, width - kiri - kanan);
  const batasMaks = Math.max(...rows.map((r) => r.batas ?? 0), 0.4);
  const potong = Math.max(batasMaks * 2, Math.min(Math.max(...rows.map((r) => r.cos)), batasMaks * 2));
  const xOf = (v: number) => kiri + (Math.min(v, potong) / potong) * plotW;
  return (
    <div ref={ref} className="relative w-full">
      {width > 0 ? (
        <svg width={width} height={total} role="img" aria-label="COS per kelompok kanal dibanding batas">
          {rows.map((r, i) => {
            const y = ys[i];
            const h = tinggi(r);
            const anak = r.jenis === "anak";
            const adaBatas = r.batas !== null;
            const aman = adaBatas && r.cos <= (r.batas as number);
            const terpotong = r.cos > potong;
            const w = xOf(r.cos) - kiri;
            const tb = anak ? 16 : 26;
            const warna = !adaBatas ? "var(--ink-muted)" : aman ? "var(--good)" : "var(--critical)";
            return (
              <g key={r.id} opacity={aktif && aktif !== r.id ? 0.45 : 1}
                 onMouseEnter={() => setAktif(r.id)} onMouseLeave={() => setAktif(null)}>
                <rect x={0} y={y} width={width} height={h} fill="transparent" />
                {anak ? (
                  <text x={kiri - 14} y={y + h / 2} textAnchor="end" dominantBaseline="middle"
                        fontSize={UKURAN.label - 2} fontWeight={500} fill="var(--ink-2)">{r.label}</text>
                ) : (
                  <>
                    <text x={kiri - 14} y={y + h / 2 - (r.sub ? 8 : 0)} textAnchor="end" dominantBaseline="middle"
                          fontSize={UKURAN.label} fontWeight={700} fill="var(--ink)">{r.label}</text>
                    {r.sub ? (
                      <text x={kiri - 14} y={y + h / 2 + 11} textAnchor="end" dominantBaseline="middle"
                            fontSize={12} fill="var(--ink-muted)">{r.sub}</text>
                    ) : null}
                  </>
                )}
                <path d={barPath(kiri, y + (h - tb) / 2, Math.max(w, 2), tb, 4, terpotong ? "none" : "right")}
                      fill={warna} opacity={anak ? 0.55 : 1} />
                {adaBatas ? (
                  <line x1={xOf(r.batas as number)} x2={xOf(r.batas as number)} y1={y + 6} y2={y + h - 6}
                        stroke="var(--ink)" strokeWidth={2} strokeDasharray="4 3" />
                ) : null}
                <text x={xOf(r.cos) + 12} y={y + h / 2} dominantBaseline="middle"
                      fontSize={anak ? UKURAN.nilai - 2 : UKURAN.nilai} fill={anak ? "var(--ink-2)" : "var(--ink)"}>
                  <tspan fontWeight={anak ? 600 : 700}>{`${terpotong ? "▶ " : ""}${fmtPersen(r.cos)}`}</tspan>
                  {adaBatas ? (
                    <tspan fill={aman ? "var(--good-fg)" : "var(--critical-fg)"} fontWeight={600}>{aman ? "  ✓ aman" : "  ✕ lewat"}</tspan>
                  ) : null}
                </text>
              </g>
            );
          })}
        </svg>
      ) : <div style={{ height: total }} />}
      {aktif ? (() => {
        const r = rows.find((x) => x.id === aktif)!;
        return <Tooltip x={Math.min(width - 120, xOf(r.cos))} y={ys[rows.indexOf(r)] + 8}
                        teks={`${r.label}${r.sub ? ` (${r.sub})` : ""}: COS ${fmtPersen(r.cos)}${r.batas !== null ? ` · batas ≤ ${fmtPersen(r.batas)}` : " · tanpa batas"}`} />;
      })() : null}
      <p className="mt-2 text-sm text-ink-2">
        Garis putus-putus = batas COS kelompok dari sheet. Kanal di bawahnya ditampilkan tanpa batas — sheet hanya
        memberi batas per kelompok.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- ③ */

export interface TitikTren {
  bulan: string;   // label pendek, mis. "Sep"
  panjang: string; // "September 2026"
  nilai: number;
  batas?: number | null;
}

/** Omset per bulan: kolom, bulan terpilih ditebalkan, nilai di atasnya. */
export function KolomOmset({ titik, aktif }: { titik: TitikTren[]; aktif: string }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const tinggi = 240, atas = 28, bawah = 34;
  const plotH = tinggi - atas - bawah;
  const skala = niceScale(0, Math.max(...titik.map((t) => t.nilai), 1), 4);
  const lebarKol = width / Math.max(titik.length, 1);
  const yOf = (v: number) => atas + plotH - (v / (skala.max || 1)) * plotH;
  return (
    <div ref={ref} className="relative w-full">
      {width > 0 ? (
        <svg width={width} height={tinggi} role="img" aria-label="Omset per bulan">
          <line x1={0} x2={width} y1={atas + plotH} y2={atas + plotH} stroke="var(--axis)" />
          {titik.map((t, i) => {
            const pilih = t.panjang === aktif;
            const w = Math.min(lebarKol * 0.62, 46);
            const x = i * lebarKol + (lebarKol - w) / 2;
            return (
              <g key={t.panjang} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={i * lebarKol} y={0} width={lebarKol} height={tinggi} fill="transparent" />
                <path d={barPath(x, yOf(t.nilai), w, atas + plotH - yOf(t.nilai), 4, "top")}
                      fill={pilih ? "var(--s1)" : "var(--seq-250)"} />
                {pilih || hover === i ? (
                  <text x={x + w / 2} y={yOf(t.nilai) - 8} textAnchor="middle" fontSize={UKURAN.nilai} fontWeight={700} fill="var(--ink)">
                    {fmtJt(t.nilai).replace("Rp ", "")}
                  </text>
                ) : null}
                <text x={x + w / 2} y={tinggi - 10} textAnchor="middle" fontSize={UKURAN.sumbu}
                      fontWeight={pilih ? 700 : 500} fill={pilih ? "var(--ink)" : "var(--ink-2)"}>{t.bulan}</text>
              </g>
            );
          })}
        </svg>
      ) : <div style={{ height: tinggi }} />}
    </div>
  );
}

/** COS per bulan: garis + titik berstatus, batas sebagai garis tangga putus-putus. */
export function GarisCos({ titik, aktif }: { titik: TitikTren[]; aktif: string }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const tinggi = 240, atas = 28, bawah = 34, kiri = 8, kanan = 8;
  const plotH = tinggi - atas - bawah;
  const semua = titik.flatMap((t) => [t.nilai, t.batas ?? 0]);
  const skala = niceScale(Math.min(...semua) * 0.85, Math.max(...semua) * 1.08, 4);
  const lebarKol = (width - kiri - kanan) / Math.max(titik.length, 1);
  const xOf = (i: number) => kiri + i * lebarKol + lebarKol / 2;
  const yOf = (v: number) => atas + plotH - ((v - skala.min) / ((skala.max - skala.min) || 1)) * plotH;
  const tangga = titik.flatMap((t, i) =>
    t.batas == null ? [] : [{ x: xOf(i) - lebarKol / 2, y: yOf(t.batas) }, { x: xOf(i) + lebarKol / 2, y: yOf(t.batas) }]);
  return (
    <div ref={ref} className="relative w-full">
      {width > 0 ? (
        <svg width={width} height={tinggi} role="img" aria-label="COS per bulan dibanding batas">
          <line x1={0} x2={width} y1={atas + plotH} y2={atas + plotH} stroke="var(--axis)" />
          {tangga.length ? <path d={linePath(tangga)} fill="none" stroke="var(--ink-2)" strokeWidth={2} strokeDasharray="5 4" /> : null}
          <path d={linePath(titik.map((t, i) => ({ x: xOf(i), y: yOf(t.nilai) })))} fill="none" stroke="var(--s1)" strokeWidth={2.5} />
          {titik.map((t, i) => {
            const pilih = t.panjang === aktif;
            const aman = t.batas == null || t.nilai <= t.batas;
            return (
              <g key={t.panjang} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={xOf(i) - lebarKol / 2} y={0} width={lebarKol} height={tinggi} fill="transparent" />
                <circle cx={xOf(i)} cy={yOf(t.nilai)} r={pilih ? 8 : 6} fill={aman ? "var(--good)" : "var(--critical)"}
                        stroke="var(--surface)" strokeWidth={2} />
                {pilih || hover === i ? (
                  <text x={xOf(i)} y={yOf(t.nilai) - 14} textAnchor="middle" fontSize={UKURAN.nilai} fontWeight={700} fill="var(--ink)">
                    {fmtPersen(t.nilai)}
                  </text>
                ) : null}
                <text x={xOf(i)} y={tinggi - 10} textAnchor="middle" fontSize={UKURAN.sumbu}
                      fontWeight={pilih ? 700 : 500} fill={pilih ? "var(--ink)" : "var(--ink-2)"}>{t.bulan}</text>
              </g>
            );
          })}
        </svg>
      ) : <div style={{ height: tinggi }} />}
      {hover !== null && titik[hover].batas != null ? (
        <Tooltip x={xOf(hover)} y={yOf(titik[hover].nilai) - 24}
                 teks={`${titik[hover].panjang}: COS ${fmtPersen(titik[hover].nilai)} · batas ≤ ${fmtPersen(titik[hover].batas!)}`} />
      ) : null}
      <p className="mt-2 text-sm text-ink-2">
        <span style={{ color: "var(--good-fg)" }}>● hijau = aman</span> · <span style={{ color: "var(--critical-fg)" }}>● merah = lewat batas</span> · garis putus-putus = batas COS
      </p>
    </div>
  );
}
