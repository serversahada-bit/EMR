"use client";

import { Suspense, use, type ReactNode } from "react";

/**
 * Tampilkan bagian halaman yang datanya masih dimuat TANPA menahan bagian
 * lain. Halaman server mengirim Promise (tidak di-await) — misalnya tren
 * 12 bulan yang berat — sehingga kartu dan angka ringan langsung tampil,
 * lalu bagian ini menyusul sendiri begitu datanya siap.
 *
 * Promise harus sudah diberi .catch di server (hasilkan null) supaya galat
 * di bagian ini tidak merusak seluruh halaman.
 */
export function Tunggu<T>({
  janji,
  cadangan,
  children,
}: {
  janji: Promise<T>;
  /** Tampilan sementara selama data dimuat. */
  cadangan: ReactNode;
  children: (nilai: T) => ReactNode;
}) {
  return (
    <Suspense fallback={cadangan}>
      <Isi janji={janji}>{children}</Isi>
    </Suspense>
  );
}

function Isi<T>({ janji, children }: { janji: Promise<T>; children: (nilai: T) => ReactNode }) {
  return <>{children(use(janji))}</>;
}

/** Kerangka kartu grafik yang sedang dimuat — judulnya sudah tampil. */
export function KerangkaGrafik({
  judul,
  sub,
  tinggi = 260,
  className = "",
}: {
  judul: string;
  sub?: string;
  tinggi?: number;
  className?: string;
}) {
  return (
    <div className={"rounded-2xl border border-hairline bg-surface p-5 " + className} aria-busy="true">
      <p className="text-[15px] font-semibold leading-tight text-ink">{judul}</p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
      <div className="mt-4 animate-pulse rounded-xl bg-[var(--surface-sunken)]" style={{ height: tinggi }} />
      <p className="mt-2 text-[11px] text-muted">Memuat data…</p>
    </div>
  );
}
