import type { ReactNode } from "react";
import type { CampaignStatus, InitiativeStatus } from "@/data/types";
import { formatDelta } from "@/lib/format";

/** Chip netral — dipakai untuk menampilkan periode aktif di kepala kartu. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline bg-page px-2.5 py-1 text-[11px] font-medium text-ink-2">
      {children}
    </span>
  );
}

/** Pil delta: latar lunak + tinta gelap, arah dibawa ikon dan tanda. */
export function DeltaPill({
  value,
  upIsGood = true,
  unit = "percent",
}: {
  value: number | null;
  upIsGood?: boolean;
  unit?: "percent" | "pp";
}) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className="inline-flex items-center rounded-full bg-page px-2 py-0.5 text-[11px] font-medium text-muted">
        Tanpa pembanding
      </span>
    );
  }

  const isGood = upIsGood ? value >= 0 : value <= 0;
  const neutral = value === 0;
  const background = neutral
    ? "var(--surface-sunken)"
    : isGood
      ? "var(--good-bg)"
      : "var(--critical-bg)";
  const color = neutral
    ? "var(--ink-2)"
    : isGood
      ? "var(--good-fg)"
      : "var(--critical-fg)";

  const text =
    unit === "pp"
      ? `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)
          .toFixed(1)
          .replace(".", ",")} pp`
      : formatDelta(value);

  return (
    <span
      className="tnum inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background, color }}
    >
      <span aria-hidden>{value > 0 ? "▲" : value < 0 ? "▼" : "—"}</span>
      {text}
    </span>
  );
}

const STATUS: Record<
  InitiativeStatus,
  { label: string; icon: string; bg: string; fg: string }
> = {
  good: {
    label: "Sesuai rencana",
    icon: "✓",
    bg: "var(--good-bg)",
    fg: "var(--good-fg)",
  },
  warning: {
    label: "Perlu perhatian",
    icon: "!",
    bg: "var(--warning-bg)",
    fg: "var(--warning-fg)",
  },
  serious: {
    label: "Terlambat",
    icon: "▲",
    bg: "var(--serious-bg)",
    fg: "var(--serious-fg)",
  },
  critical: {
    label: "Kritis",
    icon: "✕",
    bg: "var(--critical-bg)",
    fg: "var(--critical-fg)",
  },
};

/** Status selalu ikon + label; warna hanya memperkuat, tidak menggantikan. */
export function StatusPill({ status }: { status: InitiativeStatus }) {
  const spec = STATUS[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: spec.bg, color: spec.fg }}
    >
      <span aria-hidden>{spec.icon}</span>
      {spec.label}
    </span>
  );
}

export function statusText(status: InitiativeStatus): string {
  return STATUS[status].label;
}

const CAMPAIGN: Record<
  CampaignStatus,
  { label: string; icon: string; bg: string; fg: string }
> = {
  aktif: {
    label: "Aktif",
    icon: "●",
    bg: "var(--good-bg)",
    fg: "var(--good-fg)",
  },
  dijeda: {
    label: "Dijeda",
    icon: "‖",
    bg: "var(--warning-bg)",
    fg: "var(--warning-fg)",
  },
  selesai: {
    label: "Selesai",
    icon: "✓",
    bg: "var(--surface-sunken)",
    fg: "var(--ink-2)",
  },
};

/** Status kampanye — ikon + label, warna hanya memperkuat. */
export function CampaignPill({ status }: { status: CampaignStatus }) {
  const spec = CAMPAIGN[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: spec.bg, color: spec.fg }}
    >
      <span aria-hidden>{spec.icon}</span>
      {spec.label}
    </span>
  );
}
