"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

const formatJam = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

/**
 * Minta ulang halaman ke server tiap `detik` detik selama tab browser
 * terlihat. router.refresh() mengganti isi tanpa memuat ulang halaman,
 * jadi posisi gulir dan pilihan di layar tidak hilang.
 *
 * `diambil` = kapan server terakhir mengambil data dari sumbernya (bukan
 * jam render), supaya pengguna tahu seberapa baru angka yang dilihat.
 */
export function MuatUlangOtomatis({
  diambil,
  detik,
  awalan = "Diperbarui",
}: {
  diambil: string;
  detik: number;
  awalan?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    }, detik * 1000);
    return () => clearInterval(t);
  }, [router, detik]);

  return (
    <div className="flex items-center gap-2 text-[11px] text-muted">
      <span className="tnum">
        {pending ? "Memuat data terbaru…" : `${awalan} ${formatJam(diambil)} WIB · otomatis tiap ${detik} dtk`}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
        className="rounded-lg border border-hairline px-2.5 py-1 font-medium text-ink-2 disabled:opacity-50"
      >
        Muat ulang
      </button>
    </div>
  );
}
