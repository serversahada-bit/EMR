/**
 * Skeleton yang tampil seketika saat berpindah halaman laporan.
 *
 * Diletakkan di level grup (report) sehingga menaungi semua rute di
 * bawahnya. Layout (sidebar, bilah atas, filter) tidak ikut dilepas,
 * jadi hanya area konten ini yang berganti skeleton — perpindahan terasa
 * langsung alih-alih "beku" menunggu query server selesai.
 *
 * Bentuknya sengaja generik (kepala + baris KPI + satu kartu besar)
 * supaya pas untuk dashboard, omset, customer, maupun meta.
 */
const blok = "rounded bg-[var(--surface-sunken)]";

export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Memuat data">
      {/* Kepala halaman */}
      <div className="mb-5">
        <div className={`h-6 w-48 ${blok}`} />
        <div className={`mt-2 h-3 w-64 ${blok}`} />
      </div>

      {/* Baris kartu ringkasan */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-hairline bg-surface px-5 py-4"
          >
            <div className={`h-3 w-24 ${blok}`} />
            <div className={`mt-3 h-5 w-20 ${blok}`} />
            <div className={`mt-2 h-2.5 w-16 ${blok}`} />
          </div>
        ))}
      </div>

      {/* Kartu besar: tabel atau grafik */}
      <div className="rounded-2xl border border-hairline bg-surface p-5">
        <div className={`h-4 w-40 ${blok}`} />
        <div className={`mt-2 h-3 w-56 ${blok}`} />
        <div className="mt-5 space-y-2.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`h-7 ${blok}`}
              /* Memudar ke bawah supaya tidak terasa seperti dinding abu. */
              style={{ opacity: 1 - i * 0.07 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
