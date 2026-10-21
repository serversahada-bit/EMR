import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { ALL_BRAND, bulanMonitoring, dataMonitoring, URUT_PRODUK } from "@/data/monitoring-queries";

import { labelBulan, Pilihan } from "../../roas/cos-ui";
import { BlokProduk, rakitBlok } from "../monitoring-ui";

export const dynamic = "force-dynamic";

/** Per kanal — satu blok per produk, persis susunan tab GENERAL MONITORING. */
export default async function MonitoringKanalPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; produk?: string }>;
}) {
  const diminta = await searchParams;
  const daftarBulan = await bulanMonitoring();
  if (daftarBulan.length === 0) {
    return (
      <>
        <PageHead title="Per kanal" subtitle="Marketing report" />
        <Card className="p-8 text-center text-sm text-ink-2">Belum ada data di tabel data_monitoring_kanal.</Card>
      </>
    );
  }
  const bulan = diminta.bulan && daftarBulan.includes(diminta.bulan) ? diminta.bulan : daftarBulan[0];
  const rows = await dataMonitoring(bulan);
  const ada = [...URUT_PRODUK, ALL_BRAND].filter((p) => rows.some((r) => r.produk === p));
  const produk = diminta.produk && ada.includes(diminta.produk) ? diminta.produk : null;
  const tampil = produk ? [produk] : ada;
  const url = (b: string, p: string | null) =>
    `/monitoring/kanal?bulan=${b}${p ? `&produk=${encodeURIComponent(p)}` : ""}`;

  return (
    <>
      <PageHead
        title="Per kanal"
        subtitle={`Marketing report · ${labelBulan(bulan)} · omset, kontribusi, dan COS per kanal`}
      />
      <Pilihan opsi={daftarBulan.map((b) => ({ nilai: b, label: labelBulan(b) }))} aktif={bulan} href={(b) => url(b, produk)} />
      <Pilihan
        opsi={[{ nilai: "", label: "Semua produk" }, ...ada.map((p) => ({ nilai: p, label: p }))]}
        aktif={produk ?? ""}
        href={(p) => url(bulan, p || null)}
      />
      <div className="mt-3">
        {tampil.map((p) => (
          <BlokProduk key={p} blok={rakitBlok(p, rows)} />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-ink-2">
        Sumber: spreadsheet &quot;Marketing Report Sahada&quot;, tab GENERAL MONITORING bulan ini (bulan diambil dari
        nama tab; label di dalam tab kadang basi). COS = realisasi spend ÷ omset. Omset Meta dan CRM di sheet =
        box × harga tetap per bulan.
      </p>
    </>
  );
}
