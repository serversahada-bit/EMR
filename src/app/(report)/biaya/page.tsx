"use client";

import { Card } from "@/components/Card";
import { ChartFrame } from "@/components/ChartFrame";
import { DataTable } from "@/components/DataTable";
import { DivergingBarChart } from "@/components/DivergingBarChart";
import { Legend } from "@/components/Legend";
import { LineChart } from "@/components/LineChart";
import { TintedList } from "@/components/Lists";
import { PageHead } from "@/components/PageHead";
import { StackedBarChart } from "@/components/StackedBarChart";
import {
  cashColumns,
  costColumns,
  marginColumns,
} from "@/components/columns";
import { COST_PARTS } from "@/data/costParts";
import {
  formatCompact,
  formatIDR,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { useReport } from "@/lib/report-context";

export default function BiayaPage() {
  const { series, byDivision, metrics, periodChip } = useReport();

  return (
    <>
      <PageHead title="Biaya & marjin" subtitle="Struktur biaya, marjin, dan arus kas bulanan" />

      <div className="grid gap-4 lg:grid-cols-12">
        <ChartFrame
          className="lg:col-span-7"
          title="Struktur biaya"
          subtitle="Komposisi beban per bulan"
          chip={periodChip}
          legend={
            <Legend
              items={COST_PARTS.map((part) => ({
                label: part.label,
                color: `var(--s${part.slot})`,
              }))}
            />
          }
          footnote="Beban pegawai dan operasional relatif tetap, sehingga porsinya naik saat pendapatan turun."
          chart={
            <StackedBarChart
              categories={series}
              height={228}
              formatValue={(v) => formatIDR(v)}
              formatTick={(v) => formatCompact(v, 0)}
              totalLabel="Total biaya"
              series={COST_PARTS.map((part) => ({
                id: part.id,
                label: part.label,
                color: `var(--s${part.slot})`,
                values: series.map((p) => p[part.id]),
              }))}
            />
          }
          table={
            <DataTable
              rows={series}
              rowKey={(row) => row.month}
              columns={costColumns}
            />
          }
        />
        <Card className="p-5 lg:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[15px] font-semibold leading-tight text-ink">
              Komposisi biaya
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Porsi tiap komponen terhadap total {formatIDR(metrics.totalCost)}
          </p>

          <div className="mt-4">
            <TintedList
              rows={COST_PARTS.map((part) => ({
                id: part.id,
                label: part.label,
                slot: part.slot,
                value: formatPercent(
                  (metrics[part.id] / (metrics.totalCost || 1)) * 100,
                  0,
                ),
              }))}
            />
          </div>
        </Card>

        <ChartFrame
          className="lg:col-span-4"
          title="Biaya per divisi"
          subtitle="Total beban periode terpilih"
          chart={
            <StackedBarChart
              categories={byDivision.map((row) => ({
                label: row.short,
                longLabel: row.name,
              }))}
              height={196}
              formatValue={(v) => formatIDR(v)}
              formatTick={(v) => formatCompact(v, 0)}
              totalLabel="Total biaya"
              series={[
                {
                  id: "totalCost",
                  label: "Total biaya",
                  color: "var(--s1)",
                  values: byDivision.map((row) => row.totalCost),
                },
              ]}
            />
          }
          table={
            <DataTable
              rows={byDivision}
              rowKey={(row) => row.divisionId}
              columns={[
                { key: "name", header: "Divisi", render: (r) => r.name },
                {
                  key: "cost",
                  header: "Total biaya",
                  numeric: true,
                  render: (r) => formatIDR(r.totalCost),
                },
                {
                  key: "margin",
                  header: "Marjin bersih",
                  numeric: true,
                  render: (r) => formatPercent(r.netMargin),
                },
              ]}
            />
          }
        />

        <ChartFrame
          className="lg:col-span-8"
          title="Marjin kotor & marjin bersih"
          subtitle="Persen terhadap pendapatan"
          chip={periodChip}
          legend={
            <Legend
              items={[
                {
                  label: "Marjin kotor",
                  color: "var(--s1)",
                  shape: "line",
                },
                {
                  label: "Marjin bersih",
                  color: "var(--s2)",
                  shape: "line",
                },
              ]}
            />
          }
          chart={
            <LineChart
              categories={series}
              height={196}
              zeroBased
              formatValue={(v) => formatPercent(v)}
              formatTick={(v) => formatNumber(v, 0) + "%"}
              series={[
                {
                  id: "gross",
                  label: "Marjin kotor",
                  color: "var(--s1)",
                  values: series.map((p) => p.grossMargin),
                  labelEnd: true,
                },
                {
                  id: "net",
                  label: "Marjin bersih",
                  color: "var(--s2)",
                  values: series.map((p) => p.netMargin),
                  labelEnd: true,
                },
              ]}
            />
          }
          table={
            <DataTable
              rows={series}
              rowKey={(row) => row.month}
              columns={marginColumns}
            />
          }
        />

        <ChartFrame
          className="lg:col-span-12"
          title="Arus kas bersih bulanan"
          subtitle="Penerimaan dikurangi pengeluaran, termasuk belanja modal"
          chip={periodChip}
          footnote="Batang biru = surplus kas, batang merah = defisit kas pada bulan tersebut."
          chart={
            <DivergingBarChart
              categories={series}
              values={series.map((p) => p.netCashFlow)}
              height={188}
              seriesLabel="Arus kas bersih"
              formatValue={(v) => formatIDR(v)}
              formatTick={(v) => formatCompact(v, 0)}
            />
          }
          table={
            <DataTable
              rows={series}
              rowKey={(row) => row.month}
              columns={cashColumns}
            />
          }
        />
      </div>
    </>
  );
}
