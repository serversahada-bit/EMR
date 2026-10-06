import type { ReactNode } from "react";

export interface RankRow {
  id: string;
  name: string;
  sub?: string;
  value: string;
  badge?: ReactNode;
}

/** Daftar berperingkat dengan inisial — dipakai untuk urutan divisi. */
export function RankList({ rows }: { rows: RankRow[] }) {
  if (!rows.length) {
    return <p className="py-6 text-center text-xs text-muted">Tidak ada data.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {rows.map((row, index) => (
        <li key={row.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
            style={{
              background: `var(--tint-s${(index % 5) + 1})`,
              color: "var(--ink-2)",
            }}
            aria-hidden
          >
            {initials(row.name)}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">{row.name}</p>
            {row.sub ? (
              <p className="truncate text-[11px] text-muted">{row.sub}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {row.badge}
            <span
              className="tnum text-[13px] font-semibold"
              style={{ color: "var(--s1)" }}
            >
              {row.value}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface TintedRow {
  id: string;
  label: string;
  value: string;
  /** Slot warna 1–5, menentukan tinta latar baris. */
  slot: number;
}

/** Daftar bagian-terhadap-keseluruhan dengan latar bertinta per slot. */
export function TintedList({ rows }: { rows: TintedRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
          style={{ background: `var(--tint-s${row.slot})` }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: `var(--s${row.slot})` }}
            />
            <span className="truncate text-[13px] text-ink-2">{row.label}</span>
          </span>
          <span className="tnum shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink">
            {row.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface Stage {
  id: string;
  label: string;
  value: string;
  /** Rasio terhadap tahap sebelumnya, mis. "CTR 2,1%". */
  rate?: string;
  /** Langkah ramp ordinal 1–3 (terang → gelap). */
  step: 1 | 2 | 3;
}

const STEP_COLOR: Record<1 | 2 | 3, string> = {
  1: "var(--seq-250)",
  2: "var(--seq-450)",
  3: "var(--seq-650)",
};

/**
 * Tahap corong ditulis sebagai daftar bernilai, bukan batang
 * proporsional: tayangan dan konversi berbeda beberapa orde
 * besaran, sehingga batang linier akan menyesatkan.
 */
export function StageList({ stages }: { stages: Stage[] }) {
  return (
    <ol className="space-y-2.5">
      {stages.map((stage) => (
        <li
          key={stage.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2.5"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="h-6 w-1.5 shrink-0 rounded-full"
              style={{ background: STEP_COLOR[stage.step] }}
            />
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-ink-2">
                {stage.label}
              </span>
              {stage.rate ? (
                <span className="tnum block text-[11px] text-muted">
                  {stage.rate}
                </span>
              ) : null}
            </span>
          </span>
          <span className="tnum shrink-0 text-[15px] font-semibold text-ink">
            {stage.value}
          </span>
        </li>
      ))}
    </ol>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}
