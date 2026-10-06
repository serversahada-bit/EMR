"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";

import { FilterBar } from "@/components/FilterBar";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { meta } from "@/data/report";
import {
  getNavServerSnapshot,
  getNavSnapshot,
  subscribeNav,
  toggleNav,
} from "@/lib/navStore";
import { ReportProvider, useReport } from "@/lib/report-context";

/**
 * Cangkang laporan: sidebar, bilah atas, dan satu baris filter yang
 * menaungi semua halaman. Layout tidak ikut dilepas saat berpindah
 * rute, jadi pilihan periode dan unit bisnis bertahan.
 */
export default function ReportLayout({ children }: { children: ReactNode }) {
  const navExpanded = useSyncExternalStore(
    subscribeNav,
    getNavSnapshot,
    getNavServerSnapshot,
  );

  return (
    <ReportProvider>
      <div className="min-h-screen bg-page">
        <Sidebar expanded={navExpanded} onToggle={toggleNav} />

        <div
          className={
            "transition-[padding] duration-200 " +
            (navExpanded ? "pl-56" : "pl-14")
          }
        >
          <Shell>{children}</Shell>
        </div>
      </div>
    </ReportProvider>
  );
}

/* Halaman yang membaca database operasional punya pemilih bulannya
   sendiri, jadi baris filter data contoh tidak ditampilkan di sana. */
const RUTE_DATA_RIIL = [
  "/",
  "/omset",
  "/meta",
  "/meta/spend-iklan",
  "/customer",
  "/sync",
];

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dataRiil = RUTE_DATA_RIIL.includes(pathname);

  const {
    periodId,
    divisionId,
    query,
    setPeriodId,
    setDivisionId,
    setQuery,
    period,
    matchedDivisions,
    matchedInitiatives,
  } = useReport();

  return (
    <>
      <TopBar query={query} onQueryChange={setQuery} />

      {/* Satu baris filter untuk halaman yang memakai data contoh */}
      {dataRiil ? null : (
        <div className="sticky top-14 z-10 border-b border-hairline bg-page/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterBar
              periodId={periodId}
              divisionId={divisionId}
              onPeriodChange={setPeriodId}
              onDivisionChange={setDivisionId}
            />
            <p className="text-[11px] text-muted">
              {period.caption} · data per {meta.asOf}
            </p>
          </div>
        </div>
      )}

      <main className="px-4 pb-10 pt-6 sm:px-6">
        {meta.isSampleData && !dataRiil ? (
          <p
            className="mb-6 rounded-xl px-4 py-3 text-xs leading-relaxed text-ink-2"
            style={{ background: "var(--surface-sunken)" }}
          >
            <strong className="font-semibold text-ink">Data contoh.</strong>{" "}
            Angka di halaman ini berasal dari{" "}
            <code className="text-[11px]">src/data/sample.ts</code>. Ganti modul
            itu dengan data riil — tata letak tidak perlu diubah.
          </p>
        ) : null}

        {query && !dataRiil ? (
          <p className="mb-5 text-xs text-ink-2">
            Pencarian <strong className="font-semibold">“{query}”</strong>{" "}
            menyaring daftar divisi, kampanye, dan inisiatif —{" "}
            {matchedDivisions.length} divisi, {matchedInitiatives.length}{" "}
            inisiatif. Kartu KPI dan grafik tetap mengikuti filter periode.
          </p>
        ) : null}

        {children}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5">
          <p className="text-[11px] text-muted">
            © {meta.asOf.slice(-4)} {meta.company}. Disusun oleh{" "}
            {meta.preparedBy}. Satuan {meta.currency}.
          </p>
          <p className="text-[11px] text-muted">
            {dataRiil
              ? "Halaman ini membaca database operasional secara langsung."
              : "Angka mengikuti periode dan unit bisnis pada baris filter di atas."}
          </p>
        </footer>
      </main>
    </>
  );
}
