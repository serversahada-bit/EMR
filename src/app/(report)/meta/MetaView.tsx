"use client";

import { BarChart } from "@/components/BarChart";
import { Card, CardHead } from "@/components/Card";
import { ChartFrame } from "@/components/ChartFrame";
import { DataTable, type Column } from "@/components/DataTable";
import { KpiCard } from "@/components/KpiCard";
import { LineChart } from "@/components/LineChart";
import { MonthPicker, labelBulan } from "@/components/MonthPicker";
import { PageHead } from "@/components/PageHead";
import { IconCoins, IconDocument, IconMegaphone, IconTrend } from "@/components/icons";
import {
  formatCompact,
  formatIDR,
  formatIDRPenuh,
  formatNumber,
} from "@/lib/format";

interface MonthlySpend {
  month: string;
  spend: number;
  records: number;
  sources: number;
  lastDate: string;
}

interface SourceSpend {
  id: string;
  label: string;
  table: string;
  spend: number;
  records: number;
}

export interface MetaReportData {
  bulan: string;
  bulanKini: string;
  pilihan: string[];
  monthly: MonthlySpend[];
  bySource: SourceSpend[];
}

const exactIDR = (value: number) =>
  "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);

function bulanSebelumnya(bulan: string): string {
  const year = Number(bulan.slice(0, 4));
  const month = Number(bulan.slice(5, 7));
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, "0")}`;
}

const monthlyColumns: Column<MonthlySpend>[] = [
  { key: "month", header: "Bulan", render: (row) => labelBulan(row.month) },
  { key: "spend", header: "Spend iklan", numeric: true, render: (row) => exactIDR(row.spend) },
  { key: "sources", header: "Tabel aktif", numeric: true, render: (row) => formatNumber(row.sources) },
  { key: "records", header: "Baris", numeric: true, render: (row) => formatNumber(row.records) },
];

const sourceColumns: Column<SourceSpend>[] = [
  {
    key: "source",
    header: "Sumber",
    render: (row) => (
      <span className="block">
        <span className="block font-medium text-ink">{row.label}</span>
        <span className="block text-[11px] text-muted">{row.table}</span>
      </span>
    ),
  },
  { key: "spend", header: "Spend iklan", numeric: true, render: (row) => exactIDR(row.spend) },
  { key: "records", header: "Baris", numeric: true, render: (row) => formatNumber(row.records) },
];

export function MetaView({ data }: { data: MetaReportData }) {
  const { bulan, bulanKini, pilihan, monthly, bySource } = data;
  const selected = monthly.find((row) => row.month === bulan) ?? {
    month: bulan,
    spend: 0,
    records: 0,
    sources: 0,
    lastDate: "",
  };
  const priorMonth = bulanSebelumnya(bulan);
  const prior = monthly.find((row) => row.month === priorMonth);
  const isCurrent = bulan === bulanKini;
  const delta = !isCurrent && prior?.spend
    ? ((selected.spend - prior.spend) / prior.spend) * 100
    : null;
  const trend = monthly.filter((row) => row.month <= bulan).slice(-12);
  const sourcesSorted = [...bySource].sort((a, b) => b.spend - a.spend);
  const activeSources = sourcesSorted.filter((row) => row.records > 0);
  const history = [...monthly].reverse();

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <PageHead
          title="Meta Ads"
          subtitle={`Laporan spend iklan bulanan dari 7 tabel · ${labelBulan(bulan)}`}
        />
        <div className="mb-5">
          <MonthPicker nilai={bulan} pilihan={pilihan} basePath="/meta" />
        </div>
      </div>

      {isCurrent ? (
        <p className="mb-5 rounded-xl border border-hairline bg-surface px-4 py-3 text-xs leading-relaxed text-ink-2">
          Bulan berjalan. {selected.lastDate
            ? `Data terakhir tercatat pada ${selected.lastDate}.`
            : "Belum ada data spend pada bulan ini."} Total dapat bertambah saat data harian masuk.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Spend bulan terpilih"
          value={formatIDRPenuh(selected.spend)}
          icon={IconMegaphone}
          tint="var(--tint-s1)"
          color="var(--s1)"
          delta={delta}
          comparison={isCurrent ? "bulan berjalan" : `vs ${labelBulan(priorMonth)}`}
          trend={trend.map((row) => row.spend)}
        />
        <KpiCard
          label="Bulan sebelumnya"
          value={prior ? formatIDR(prior.spend) : "—"}
          icon={IconTrend}
          tint="var(--tint-s2)"
          color="var(--s2)"
          comparison={labelBulan(priorMonth)}
        />
        <KpiCard
          label="Tabel aktif"
          value={formatNumber(selected.sources) + " / 7"}
          icon={IconCoins}
          tint="var(--tint-s3)"
          color="var(--s3)"
          comparison={labelBulan(bulan)}
        />
        <KpiCard
          label="Baris harian"
          value={formatNumber(selected.records)}
          icon={IconDocument}
          tint="var(--tint-s4)"
          color="var(--s4)"
          comparison={labelBulan(bulan)}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <ChartFrame
          className="lg:col-span-7"
          title="Tren spend bulanan"
          subtitle="12 bulan sampai periode terpilih"
          footnote="Total dijumlahkan dari spend_iklan pada ketujuh tabel, tanpa PPN. Bulan berjalan dapat belum lengkap."
          chart={
            <LineChart
              categories={trend.map((row) => ({
                label: labelBulan(row.month).slice(0, 3),
                longLabel: labelBulan(row.month),
              }))}
              height={210}
              zeroBased
              formatValue={formatIDR}
              formatTick={(value) => formatCompact(value, 0)}
              series={[{
                id: "spend",
                label: "Spend Meta",
                color: "var(--s1)",
                values: trend.map((row) => row.spend),
                area: true,
              }]}
            />
          }
          table={<DataTable rows={trend} rowKey={(row) => row.month} columns={monthlyColumns} />}
        />

        <ChartFrame
          className="lg:col-span-5"
          title="Rincian per tabel"
          subtitle={labelBulan(bulan)}
          footnote="Setiap tabel dihitung sebagai sumber tersendiri. Nilai pada grafik dan tabel memakai spend_iklan tanpa PPN."
          chart={activeSources.length ? (
            <BarChart
              rows={activeSources.map((row) => ({ id: row.id, label: row.label, value: row.spend }))}
              formatValue={formatIDR}
              labelWidth={125}
            />
          ) : (
            <p className="flex h-40 items-center justify-center text-xs text-muted">
              Belum ada spend untuk bulan ini.
            </p>
          )}
          table={<DataTable rows={sourcesSorted} rowKey={(row) => row.id} columns={sourceColumns} />}
        />
      </div>

      <Card className="mt-4">
        <CardHead title="Riwayat seluruh bulan" subtitle="Gabungan ketujuh tabel, bulan terbaru lebih dulu" />
        <div className="px-5 pb-5">
          <DataTable rows={history} rowKey={(row) => row.month} columns={monthlyColumns} />
        </div>
      </Card>
    </>
  );
}