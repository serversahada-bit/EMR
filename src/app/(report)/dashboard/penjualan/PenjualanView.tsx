"use client";

import { BarChart } from "@/components/BarChart";
import { ChartFrame } from "@/components/ChartFrame";
import { DataTable, type Column } from "@/components/DataTable";
import { IconCoins, IconDocument, IconTrend, IconUsers } from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { MonthPicker, labelBulan } from "@/components/MonthPicker";
import { PageHead } from "@/components/PageHead";
import { StackedBarChart } from "@/components/StackedBarChart";
import type {
  BarisMetode,
  BarisUkuran,
  BarisWaktu,
  RingkasPenjualan,
} from "@/data/analitik-queries";
import { formatCount, formatIDR, formatIDRPenuh, formatPercent, formatTickCompact } from "@/lib/format";

export interface PenjualanData {
  bulan: string;
  tersedia: string[];
  sebelum: string | null;
  /** Hari ke-N pemotong pembanding; null = bulan penuh lawan penuh. */
  hari1N: number | null;
  ringkas: RingkasPenjualan;
  lalu: RingkasPenjualan | null;
  metode: BarisMetode[];
  jam: BarisWaktu[];
  hari: BarisWaktu[];
  ukuran: BarisUkuran[];
  nolJam: number;
}

const NAMA_HARI = ["", "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
/** Senin dulu, Minggu terakhir — DAYOFWEEK: 1 = Minggu. */
const URUT_HARI = [2, 3, 4, 5, 6, 7, 1];

const bagi = (a: number, b: number) => (b > 0 ? a / b : null);
const naik = (kini: number | null, lalu: number | null | undefined) =>
  kini !== null && lalu ? ((kini - lalu) / Math.abs(lalu)) * 100 : null;

export function PenjualanView({ data }: { data: PenjualanData }) {
  const { bulan, tersedia, sebelum, hari1N, ringkas, lalu, metode, jam, hari, ukuran, nolJam } = data;

  const pembanding = sebelum ? `vs ${hari1N ? `1–${hari1N} ` : ""}${labelBulan(sebelum)}` : "tanpa pembanding";
  const aov = bagi(ringkas.omset, ringkas.transaksi);
  const aovLalu = lalu ? bagi(lalu.omset, lalu.transaksi) : null;
  const totalMetode = metode.reduce((a, m) => a + m.omset, 0);

  const petaJam = new Map(jam.map((j) => [j.kunci, j.transaksi]));
  const jamPuncak = [...jam].sort((a, b) => b.transaksi - a.transaksi)[0];
  const petaHari = new Map(hari.map((h) => [h.kunci, h.transaksi]));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <PageHead title="Penjualan" subtitle={`Pola transaksi · ${labelBulan(bulan)} · dari data transaksi`} />
        <div className="mb-5">
          <MonthPicker nilai={bulan} pilihan={tersedia} basePath="/dashboard/penjualan" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Omset" value={formatIDRPenuh(ringkas.omset)} icon={IconCoins} tint="var(--tint-s1)" color="var(--s1)"
          delta={naik(ringkas.omset, lalu?.omset)} comparison={pembanding} />
        <KpiCard label="Transaksi" value={formatCount(ringkas.transaksi)} icon={IconDocument} tint="var(--tint-s2)" color="var(--s2)"
          delta={naik(ringkas.transaksi, lalu?.transaksi)} comparison={pembanding} />
        <KpiCard label="Rata-rata per transaksi" value={aov === null ? "—" : formatIDRPenuh(aov)} icon={IconTrend} tint="var(--tint-s3)" color="var(--s3)"
          delta={naik(aov, aovLalu)} comparison={pembanding} />
        <KpiCard label="Pembeli (nomor HP unik)" value={formatCount(ringkas.pembeli)} icon={IconUsers} tint="var(--tint-s4)" color="var(--s4)"
          delta={naik(ringkas.pembeli, lalu?.pembeli)} comparison={pembanding} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Metode pembayaran"
          subtitle={`Omset per metode · COD ${formatPercent((bagi(ringkas.transaksiCod, ringkas.transaksi) ?? 0) * 100)} dari transaksi`}
          chart={
            <BarChart
              rows={metode.map((m) => ({ id: m.metode, label: m.metode, value: m.omset }))}
              formatValue={(v) => formatIDR(v)}
              labelWidth={170}
            />
          }
          table={
            <DataTable
              rows={metode}
              rowKey={(r) => r.metode}
              columns={
                [
                  { key: "m", header: "Metode", render: (r) => r.metode },
                  { key: "t", header: "Transaksi", numeric: true, render: (r) => formatCount(r.transaksi) },
                  { key: "o", header: "Omset", numeric: true, render: (r) => formatIDR(r.omset) },
                  { key: "p", header: "Porsi omset", numeric: true, render: (r) => formatPercent((bagi(r.omset, totalMetode) ?? 0) * 100) },
                ] satisfies Column<BarisMetode>[]
              }
            />
          }
        />

        <ChartFrame
          title="Jumlah box per pesanan"
          subtitle="Banyaknya transaksi menurut jumlah box"
          chart={
            <StackedBarChart
              categories={ukuran.map((u) => ({ label: u.ukuran, longLabel: u.ukuran }))}
              series={[{ id: "trx", label: "Transaksi", color: "var(--s2)", values: ukuran.map((u) => u.transaksi) }]}
              height={220}
              formatValue={(v) => `${formatCount(v)} transaksi`}
              formatTick={formatTickCompact}
            />
          }
          table={
            <DataTable
              rows={ukuran}
              rowKey={(r) => r.ukuran}
              columns={
                [
                  { key: "u", header: "Ukuran pesanan", render: (r) => r.ukuran },
                  { key: "t", header: "Transaksi", numeric: true, render: (r) => formatCount(r.transaksi) },
                  { key: "o", header: "Omset", numeric: true, render: (r) => formatIDR(r.omset) },
                  { key: "a", header: "Rata-rata", numeric: true, render: (r) => formatIDR(bagi(r.omset, r.transaksi) ?? 0) },
                ] satisfies Column<BarisUkuran>[]
              }
            />
          }
        />

        <ChartFrame
          title="Jam pesanan masuk"
          subtitle={jamPuncak ? `Paling ramai pukul ${String(jamPuncak.kunci).padStart(2, "0")}.00` : "Belum ada data jam"}
          footnote={
            nolJam > 0
              ? `${formatCount(nolJam)} transaksi tidak dihitung: jam masuknya tidak tercatat (umumnya pesanan marketplace dengan jam pengisi 1900-01-30 00:00).`
              : undefined
          }
          chart={
            <StackedBarChart
              categories={Array.from({ length: 24 }, (_, i) => ({ label: String(i).padStart(2, "0"), longLabel: `Pukul ${String(i).padStart(2, "0")}.00` }))}
              series={[{ id: "trx", label: "Transaksi", color: "var(--s1)", values: Array.from({ length: 24 }, (_, i) => petaJam.get(i) ?? 0) }]}
              height={220}
              formatValue={(v) => `${formatCount(v)} transaksi`}
              formatTick={formatTickCompact}
            />
          }
          table={
            <DataTable
              rows={jam}
              rowKey={(r) => String(r.kunci)}
              columns={
                [
                  { key: "j", header: "Jam", render: (r) => `${String(r.kunci).padStart(2, "0")}.00` },
                  { key: "t", header: "Transaksi", numeric: true, render: (r) => formatCount(r.transaksi) },
                  { key: "o", header: "Omset", numeric: true, render: (r) => formatIDR(r.omset) },
                ] satisfies Column<BarisWaktu>[]
              }
            />
          }
        />

        <ChartFrame
          title="Hari dalam seminggu"
          subtitle="Transaksi menurut hari pesanan masuk"
          footnote={nolJam > 0 ? `Tanpa ${formatCount(nolJam)} transaksi yang waktu masuknya tidak tercatat.` : undefined}
          chart={
            <StackedBarChart
              categories={URUT_HARI.map((k) => ({ label: NAMA_HARI[k].slice(0, 3), longLabel: NAMA_HARI[k] }))}
              series={[{ id: "trx", label: "Transaksi", color: "var(--s3)", values: URUT_HARI.map((k) => petaHari.get(k) ?? 0) }]}
              height={220}
              formatValue={(v) => `${formatCount(v)} transaksi`}
              formatTick={formatTickCompact}
            />
          }
          table={
            <DataTable
              rows={URUT_HARI.map((k) => hari.find((h) => h.kunci === k) ?? { kunci: k, transaksi: 0, omset: 0 })}
              rowKey={(r) => String(r.kunci)}
              columns={
                [
                  { key: "h", header: "Hari", render: (r) => NAMA_HARI[r.kunci] },
                  { key: "t", header: "Transaksi", numeric: true, render: (r) => formatCount(r.transaksi) },
                  { key: "o", header: "Omset", numeric: true, render: (r) => formatIDR(r.omset) },
                ] satisfies Column<BarisWaktu>[]
              }
            />
          }
        />
      </div>
    </>
  );
}
