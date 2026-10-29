"use client";

import { BarChart } from "@/components/BarChart";
import { ChartFrame } from "@/components/ChartFrame";
import { DataTable, type Column } from "@/components/DataTable";
import { IconBuilding, IconCoins, IconFlag } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { MonthPicker, labelBulan } from "@/components/MonthPicker";
import { PageHead } from "@/components/PageHead";
import type { BarisWilayah } from "@/data/analitik-queries";
import { formatCount, formatIDR, formatPercent } from "@/lib/format";

export interface WilayahData {
  bulan: string;
  tersedia: string[];
  /** Semua provinsi, urut omset. */
  provinsi: BarisWilayah[];
  /** 15 kota teratas. */
  kota: BarisWilayah[];
}

const KOSONG = "(tidak diisi)";

export function WilayahView({ data }: { data: WilayahData }) {
  const { bulan, tersedia, provinsi, kota } = data;
  const total = provinsi.reduce((a, p) => a + p.omset, 0);
  const terisi = provinsi.filter((p) => p.nama !== KOSONG);
  const kosong = provinsi.find((p) => p.nama === KOSONG);
  const teratas = terisi[0];
  /* Porsi 5 provinsi teratas — seberapa terpusat penjualannya. */
  const porsi5 = terisi.slice(0, 5).reduce((a, p) => a + p.omset, 0) / (total || 1);

  const kolomProvinsi: Column<BarisWilayah>[] = [
    { key: "n", header: "Provinsi", render: (r) => r.nama },
    { key: "o", header: "Omset", numeric: true, render: (r) => formatIDR(r.omset) },
    { key: "s", header: "Porsi", numeric: true, render: (r) => formatPercent((r.omset / (total || 1)) * 100) },
    { key: "t", header: "Transaksi", numeric: true, render: (r) => formatCount(r.transaksi) },
    { key: "b", header: "Pembeli", numeric: true, render: (r) => formatCount(r.pembeli) },
    { key: "a", header: "Rata-rata", numeric: true, render: (r) => formatIDR(r.transaksi ? r.omset / r.transaksi : 0) },
  ];
  const kolomKota: Column<BarisWilayah>[] = [
    { key: "n", header: "Kota / kabupaten", render: (r) => r.nama },
    { key: "p", header: "Provinsi", render: (r) => r.provinsi ?? "—" },
    ...kolomProvinsi.slice(1),
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <PageHead title="Wilayah" subtitle={`Sebaran omset · ${labelBulan(bulan)} · dari alamat di data transaksi`} />
        <div className="mb-5">
          <MonthPicker nilai={bulan} pilihan={tersedia} basePath="/dashboard/wilayah" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Provinsi dengan penjualan" value={formatCount(terisi.length)} icon={IconFlag} tint="var(--tint-s1)" color="var(--s1)"
          comparison={kosong ? `${formatCount(kosong.transaksi)} transaksi tanpa provinsi` : "semua transaksi beralamat"} />
        <KpiCard label={teratas ? `Terbesar: ${teratas.nama}` : "Provinsi terbesar"} value={teratas ? formatIDR(teratas.omset) : "—"}
          icon={IconCoins} tint="var(--tint-s2)" color="var(--s2)"
          comparison={teratas ? `${formatPercent((teratas.omset / (total || 1)) * 100)} dari omset` : undefined} />
        <KpiCard label="Porsi 5 provinsi teratas" value={formatPercent(porsi5 * 100)} icon={IconBuilding} tint="var(--tint-s3)" color="var(--s3)"
          comparison={terisi.slice(0, 5).map((p) => p.nama).join(", ")} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="10 provinsi teratas"
          subtitle={`Omset · ${labelBulan(bulan)}`}
          chart={
            <BarChart rows={terisi.slice(0, 10).map((p) => ({ id: p.nama, label: p.nama, value: p.omset }))} formatValue={(v) => formatIDR(v)} labelWidth={170} />
          }
          table={<DataTable rows={provinsi} rowKey={(r) => r.nama} columns={kolomProvinsi} />}
        />
        <ChartFrame
          title="15 kota / kabupaten teratas"
          subtitle={`Omset · ${labelBulan(bulan)}`}
          chart={
            <BarChart rows={kota.map((k) => ({ id: `${k.nama}|${k.provinsi}`, label: k.nama, value: k.omset }))} formatValue={(v) => formatIDR(v)} labelWidth={190} />
          }
          table={<DataTable rows={kota} rowKey={(r) => `${r.nama}|${r.provinsi}`} columns={kolomKota} />}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-hairline bg-surface">
        <div className="px-5 pt-5">
          <h2 className="text-[15px] font-semibold leading-tight text-ink">Semua provinsi</h2>
          <p className="mt-1 text-xs text-muted">
            Nama wilayah dirapikan karena penulisan di data campur (&ldquo;DKI JAKARTA&rdquo; / &ldquo;Dki Jakarta&rdquo;). Pembeli = nomor HP unik.
          </p>
        </div>
        <div className="p-5">
          <DataTable rows={provinsi} rowKey={(r) => r.nama} columns={kolomProvinsi} />
        </div>
      </div>
    </>
  );
}
