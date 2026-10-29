import { Card } from "@/components/Card";
import { MuatUlangOtomatis } from "@/components/MuatUlangOtomatis";
import { PageHead } from "@/components/PageHead";
import { ALL_BRAND, URUT_PRODUK } from "@/data/monitoring-queries";
import { monitoringLive, type MonitoringLive } from "@/data/monitoring-sheet";

import { labelBulan, Pilihan } from "../../roas/cos-ui";
import { BlokProduk, rakitBlok } from "../monitoring-ui";

export const dynamic = "force-dynamic";

const SEGAR_DETIK = 60;

/**
 * Per kanal — satu blok per produk, persis susunan tab GENERAL MONITORING.
 *
 * Sama dengan halaman Marketing report: SEMUA angka (termasuk omset)
 * dibaca live dari sheet Marketing Report, tanpa impor dan tanpa omset
 * transaksi (permintaan pengguna 26 Okt 2026 — kedua menu realtime dari
 * spreadsheet). Menyegarkan sendiri tiap 60 detik.
 */
export default async function MonitoringKanalPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; produk?: string }>;
}) {
  const diminta = await searchParams;
  const tahun = new Date().getFullYear();

  let live: MonitoringLive | null = null;
  let galat: string | null = null;
  try {
    live = await monitoringLive(tahun);
    if (!live) galat = `Sheet Marketing Report ${tahun} belum terdaftar di aplikasi (SHEET_PER_TAHUN di monitoring-sheet.ts).`;
  } catch (e) {
    galat = e instanceof Error ? e.message : "Penyebab tidak diketahui.";
  }

  const daftarBulan = live ? [...live.perBulan.keys()].sort((a, b) => b.localeCompare(a)) : [];
  if (!live || daftarBulan.length === 0) {
    return (
      <>
        <PageHead title="Per kanal" subtitle="Marketing report · live dari Google Sheets" />
        <Card className="p-6">
          <p className="text-sm font-semibold text-ink">Sheet Marketing Report tidak bisa dibaca</p>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-ink-2">
            {galat ?? "Tidak ada tab GENERAL MONITORING yang terbaca utuh."}
          </p>
        </Card>
      </>
    );
  }

  const bulan = diminta.bulan && daftarBulan.includes(diminta.bulan) ? diminta.bulan : daftarBulan[0];
  const rows = live.perBulan.get(bulan) ?? [];
  // ALL BRAND paling depan (permintaan pengguna), lalu produk
  const ada = [ALL_BRAND, ...URUT_PRODUK].filter((p) => rows.some((r) => r.produk === p));
  const produk = diminta.produk && ada.includes(diminta.produk) ? diminta.produk : null;
  const tampil = produk ? [produk] : ada;
  const url = (b: string, p: string | null) =>
    `/monitoring/kanal?bulan=${b}${p ? `&produk=${encodeURIComponent(p)}` : ""}`;

  return (
    <>
      <PageHead
        title="Per kanal"
        subtitle={`Marketing report · ${labelBulan(bulan)} · omset, kontribusi, dan COS per kanal — live dari sheet`}
      />
      <Pilihan opsi={daftarBulan.map((b) => ({ nilai: b, label: labelBulan(b) }))} aktif={bulan} href={(b) => url(b, produk)} />
      <Pilihan
        opsi={[
          ...ada.filter((p) => p === ALL_BRAND).map((p) => ({ nilai: p, label: p })),
          { nilai: "", label: "Semua produk" },
          ...ada.filter((p) => p !== ALL_BRAND).map((p) => ({ nilai: p, label: p })),
        ]}
        aktif={produk ?? ""}
        href={(p) => url(bulan, p || null)}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span>
          Sumber: <strong className="font-semibold text-ink-2">{live.judul}</strong> · dibaca langsung, tanpa impor
        </span>
        <MuatUlangOtomatis diambil={live.diambil} detik={SEGAR_DETIK} awalan="Sheet dibaca" />
      </div>

      {live.catatan.length > 0 ? (
        <div
          className="mt-3 rounded-xl px-4 py-3 text-xs leading-relaxed text-ink-2"
          style={{ background: "var(--warning-bg)" }}
        >
          <strong className="font-semibold text-ink">Catatan pembacaan sheet:</strong> {live.catatan.join(" · ")}
        </div>
      ) : null}

      <div className="mt-3">
        {tampil.map((p) => (
          <BlokProduk key={p} blok={rakitBlok(p, rows)} />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-ink-2">
        Sumber: spreadsheet &quot;Marketing Report Sahada&quot;, tab GENERAL MONITORING bulan ini, dibaca live dan
        diperbarui otomatis tiap {SEGAR_DETIK} detik (bulan diambil dari nama tab; label di dalam tab kadang basi).
        COS = realisasi spend ÷ omset. Omset Meta dan CRM di sheet = box × harga tetap per bulan.
      </p>
    </>
  );
}
