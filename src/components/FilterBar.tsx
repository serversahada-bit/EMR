"use client";

import { divisions, periods } from "@/data/report";

/**
 * Satu baris filter di atas seluruh isi laporan — bukan filter
 * per kartu. Semua chart dan tabel dirender ulang pada potongan
 * data yang sama.
 */
export function FilterBar({
  periodId,
  divisionId,
  onPeriodChange,
  onDivisionChange,
}: {
  periodId: string;
  divisionId: string;
  onPeriodChange: (id: string) => void;
  onDivisionChange: (id: string) => void;
}) {
  return (
    <div className="no-print flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          Periode
        </span>
        <div
          className="flex rounded-lg border border-hairline bg-sunken p-0.5"
          role="group"
          aria-label="Pilih periode"
        >
          {periods.map((period) => (
            <button
              key={period.id}
              type="button"
              aria-pressed={periodId === period.id}
              onClick={() => onPeriodChange(period.id)}
              className={
                "rounded-[6px] px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors " +
                (periodId === period.id
                  ? "bg-surface text-ink shadow-[0_1px_2px_rgba(11,11,11,0.07)]"
                  : "text-muted hover:text-ink-2")
              }
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <label
          htmlFor="division-filter"
          className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted"
        >
          Unit bisnis
        </label>
        <select
          id="division-filter"
          value={divisionId}
          onChange={(event) => onDivisionChange(event.target.value)}
          className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink"
        >
          <option value="all">Seluruh divisi</option>
          {divisions.map((division) => (
            <option key={division.id} value={division.id}>
              {division.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
