"use client";

import { useState } from "react";
import { meta } from "@/data/report";
import { IconExpand, IconSearch } from "./icons";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export function TopBar({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const [isFullscreen, setFullscreen] = useState(false);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else {
        await document.documentElement.requestFullscreen();
        setFullscreen(true);
      }
    } catch {
      /* Peramban menolak permintaan layar penuh — biarkan status apa adanya. */
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-surface">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <div className="min-w-0 shrink-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-ink">
            {meta.company}
          </p>
          <p className="hidden text-[11px] leading-tight text-muted sm:block">
            Executive Management Report
          </p>
        </div>

        <div className="relative ml-auto w-full max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <IconSearch size={16} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Cari divisi atau inisiatif"
            aria-label="Cari divisi atau inisiatif"
            className="w-full rounded-full border border-hairline bg-page py-2 pl-9 pr-3 text-xs text-ink placeholder:text-muted focus:border-[var(--s1)] focus:outline-none"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-pressed={isFullscreen}
            title={isFullscreen ? "Keluar dari layar penuh" : "Layar penuh"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-page hover:text-ink"
          >
            <IconExpand size={18} />
            <span className="sr-only">Layar penuh</span>
          </button>

          <span
            title={"Disusun oleh " + meta.preparedBy}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-[11px] font-semibold text-ink-2"
            style={{ background: "var(--tint-s1)" }}
          >
            {initials(meta.preparedBy) || "EM"}
          </span>
        </div>
      </div>
    </header>
  );
}
