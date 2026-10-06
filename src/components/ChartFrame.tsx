"use client";

import { useState, type ReactNode } from "react";
import { Card, CardHead } from "./Card";

/**
 * Pembungkus setiap chart: kartu + kembar tabelnya.
 * Tampilan tabel wajib ada — beberapa warna seri berada di bawah
 * kontras 3:1 pada permukaan terang, dan tabel adalah jalur bacanya.
 */
export function ChartFrame({
  title,
  subtitle,
  legend,
  footnote,
  chip,
  chart,
  table,
  className = "",
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  footnote?: string;
  /** Penanda periode aktif — tampilan saja; filter sebenarnya ada di baris atas. */
  chip?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <Card className={className}>
      <CardHead
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            {chip}
            <ViewToggle value={view} onChange={setView} />
          </div>
        }
      />

      {legend ? <div className="px-5 pb-4">{legend}</div> : null}

      <div className="px-5 pb-5">
        {view === "chart" ? chart : table}
      </div>

      {footnote ? (
        <footer className="border-t border-hairline px-5 py-3">
          <p className="text-[11px] leading-relaxed text-muted">{footnote}</p>
        </footer>
      ) : null}
    </Card>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: "chart" | "table";
  onChange: (next: "chart" | "table") => void;
}) {
  return (
    <div
      className="no-print flex rounded-lg border border-hairline bg-sunken p-0.5"
      role="group"
      aria-label="Pilih tampilan data"
    >
      {(["chart", "table"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`rounded-[6px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
            value === option
              ? "bg-surface text-ink shadow-[0_1px_2px_rgba(11,11,11,0.06)]"
              : "text-muted hover:text-ink-2"
          }`}
        >
          {option === "chart" ? "Grafik" : "Tabel"}
        </button>
      ))}
    </div>
  );
}
