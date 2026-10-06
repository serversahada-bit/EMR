"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function labelBulan(kunci: string): string {
  const bulan = Number(kunci.slice(5, 7));
  if (!bulan) return kunci;
  return NAMA_BULAN[bulan - 1] + " " + kunci.slice(0, 4);
}

/** Pemilih bulan untuk halaman yang membaca data operasional riil. */
export function MonthPicker({
  nilai,
  pilihan,
  basePath,
}: {
  nilai: string;
  pilihan: string[];
  basePath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="no-print flex items-center gap-2.5">
      <label
        htmlFor="month-picker"
        className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted"
      >
        Bulan
      </label>
      <select
        id="month-picker"
        value={nilai}
        disabled={pending}
        onChange={(event) =>
          startTransition(() => {
            router.push(basePath + "?bulan=" + event.target.value);
          })
        }
        className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-60"
      >
        {pilihan.map((bulan) => (
          <option key={bulan} value={bulan}>
            {labelBulan(bulan)}
          </option>
        ))}
      </select>
      {pending ? (
        <span className="text-[11px] text-muted">memuat…</span>
      ) : null}
    </div>
  );
}
