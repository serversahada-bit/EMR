"use client";

import { Card } from "@/components/Card";
import { ChartFrame } from "@/components/ChartFrame";
import { DataTable, type Column } from "@/components/DataTable";
import { KpiCard } from "@/components/KpiCard";
import { LineChart } from "@/components/LineChart";
import { TintedList } from "@/components/Lists";
import { MonthPicker, labelBulan } from "@/components/MonthPicker";
import { PageHead } from "@/components/PageHead";
import {
  IconCoins,
  IconDocument,
  IconMegaphone,
  IconUsers,
} from "@/components/icons";
import type {
  OmsetChannel,
  RingkasDashboard,
  TitikTren,
} from "@/data/dashboard-queries";
import {
  formatCompact,
  formatIDR,
  formatIDRPenuh,
  formatMultiple,
  formatNumber,
  formatPercent,
} from "@/lib/format";

export interface DashboardData {
  bulan: string;
  bulanTersedia: string[];
  ringkas: RingkasDashboard;
  ringkasSebelum: RingkasDashboard | null;
  bulanSebelum: string | null;
  tren: TitikTren[];
  channel: OmsetChannel[];
}

/** Pengali aman: 0 belanja iklan berarti ROAS tidak terdefinisi. */
const bagi = (atas: number, bawah: number): number | null =>
  bawah > 0 ? atas / bawah : null;

export function DashboardView({ data }: { data: DashboardData }) {
  const { bulan, bulanTersedia, ringkas, ringkasSebelum, bulanSebelum, tren, channel } =
    data;

  const delta = (ambil: (r: RingkasDashboard) => number): number | null => {
    if (!ringkasSebelum) return null;
    const lalu = ambil(ringkasSebelum);
    return lalu ? ((ambil(ringkas) - lalu) / Math.abs(lalu)) * 100 : null;
  };

  const roas = bagi(ringkas.omset, ringkas.spendIklan);
  const roasLalu = ringkasSebelum
    ? bagi(ringkasSebelum.omset, ringkasSebelum.spendIklan)
    : null;

  const akuisisi = bagi(ringkas.spendIklan, ringkas.customerBaru);
  const akuisisiLalu = ringkasSebelum
    ? bagi(ringkasSebelum.spendIklan, ringkasSebelum.customerBaru)
    : null;

  const pembanding = bulanSebelum
    ? "vs " + labelBulan(bulanSebelum)
    : "tanpa pembanding";

  const kategori = tren.map((t) => ({
    label: labelBulan(t.bulan).slice(0, 3),
    longLabel: labelBulan(t.bulan),
  }));

  const aov = bagi(ringkas.omset, ringkas.transaksi);
  const porsiIklan = bagi(ringkas.spendIklan, ringkas.omset);

  /* Data iklan sering tertinggal dari data transaksi, dan ROAS yang
     membandingkan omset 5 hari terhadap belanja 2 hari terlihat seperti
     lonjakan kinerja padahal cuma selisih kelengkapan data. */
  const iklanTertinggal =
    ringkas.hariTerakhirIklan !== null &&
    ringkas.hariTerakhirTransaksi !== null &&
    ringkas.hariTerakhirIklan < ringkas.hariTerakhirTransaksi;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <PageHead
          title="Dashboard"
          subtitle={"Ikhtisar kinerja operasional · " + labelBulan(bulan)}
        />
        <div className="mb-5">
          <MonthPicker nilai={bulan} pilihan={bulanTersedia} basePath="/" />
        </div>
      </div>

      {iklanTertinggal ? (
        <div
          className="mb-5 rounded-xl px-4 py-3 text-xs leading-relaxed text-ink-2"
          style={{ background: "var(--warning-bg)" }}
        >
          <strong className="font-semibold text-ink">
            Data iklan belum lengkap.
          </strong>{" "}
          Transaksi sudah sampai {ringkas.hariTerakhirTransaksi}, sedangkan
          belanja iklan baru sampai {ringkas.hariTerakhirIklan}. ROAS dan biaya
          akuisisi bulan ini karena itu{" "}
          <strong className="font-semibold text-ink">terlalu bagus</strong> —
          pembilangnya mencakup lebih banyak hari daripada penyebutnya.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Omset"
          value={formatIDRPenuh(ringkas.omset)}
          icon={IconCoins}
          tint="var(--tint-s1)"
          color="var(--s1)"
          delta={delta((r) => r.omset)}
          comparison={pembanding}
          trend={tren.map((t) => t.omset)}
        />
        <KpiCard
          label="Belanja iklan"
          value={formatIDRPenuh(ringkas.spendIklan)}
          icon={IconMegaphone}
          tint="var(--tint-s3)"
          color="var(--s3)"
          delta={delta((r) => r.spendIklan)}
          /* Belanja naik bukan kabar baik dengan sendirinya — yang
             menentukan adalah ROAS di kartu sebelah. */
          upIsGood={false}
          comparison={pembanding}
          trend={tren.map((t) => t.spendIklan)}
        />
        <KpiCard
          label="ROAS"
          value={roas === null ? "—" : formatMultiple(roas)}
          icon={IconDocument}
          tint="var(--tint-s4)"
          color="var(--s4)"
          delta={
            roas !== null && roasLalu
              ? ((roas - roasLalu) / Math.abs(roasLalu)) * 100
              : null
          }
          comparison={pembanding}
        />
        <KpiCard
          label="Biaya akuisisi customer"
          value={akuisisi === null ? "—" : formatIDRPenuh(akuisisi)}
          icon={IconUsers}
          tint="var(--tint-s2)"
          color="var(--s2)"
          delta={
            akuisisi !== null && akuisisiLalu
              ? ((akuisisi - akuisisiLalu) / Math.abs(akuisisiLalu)) * 100
              : null
          }
          upIsGood={false}
          comparison={pembanding}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <ChartFrame
          className="lg:col-span-8"
          title="Omset dan belanja iklan"
          subtitle="12 bulan terakhir"
          footnote="Belanja iklan hanya mencakup Meta Ads; kanal lain belum terekam di database."
          chart={
            <LineChart
              categories={kategori}
              height={224}
              zeroBased
              formatValue={(v) => formatIDR(v)}
              formatTick={(v) => formatCompact(v, 0)}
              series={[
                {
                  id: "omset",
                  label: "Omset",
                  color: "var(--s1)",
                  values: tren.map((t) => t.omset),
                  labelEnd: true,
                },
                {
                  id: "iklan",
                  label: "Belanja iklan",
                  color: "var(--s3)",
                  values: tren.map((t) => t.spendIklan),
                },
              ]}
            />
          }
          table={
            <DataTable
              rows={tren}
              rowKey={(row) => row.bulan}
              columns={kolomTren}
            />
          }
        />

        <Card className="p-5 lg:col-span-4">
          <h2 className="text-[15px] font-semibold leading-tight text-ink">
            Omset per kelompok channel
          </h2>
          <p className="mt-1 text-xs text-muted">
            {labelBulan(bulan)} · dari pemetaan <code className="text-[11px]">data_channel</code>
          </p>

          <div className="mt-4">
            <TintedList
              rows={channel.slice(0, 5).map((row, i) => ({
                id: row.channel,
                label: row.channel,
                value: formatIDR(row.omset),
                slot: i + 1,
              }))}
            />
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-hairline pt-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-muted">
                Omset per transaksi
              </dt>
              <dd className="tnum mt-1 text-sm font-semibold text-ink">
                {aov === null ? "—" : formatIDR(aov)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-muted">
                Iklan terhadap omset
              </dt>
              <dd className="tnum mt-1 text-sm font-semibold text-ink">
                {porsiIklan === null ? "—" : formatPercent(porsiIklan * 100)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-muted">
                Customer baru
              </dt>
              <dd className="tnum mt-1 text-sm font-semibold text-ink">
                {formatNumber(ringkas.customerBaru)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-muted">
                Lead dari iklan
              </dt>
              <dd className="tnum mt-1 text-sm font-semibold text-ink">
                {formatNumber(ringkas.lead)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}

const kolomTren: Column<TitikTren>[] = [
  {
    key: "bulan",
    header: "Bulan",
    render: (r) => labelBulan(r.bulan),
  },
  {
    key: "omset",
    header: "Omset",
    numeric: true,
    render: (r) => formatIDR(r.omset),
  },
  {
    key: "iklan",
    header: "Belanja iklan",
    numeric: true,
    render: (r) => formatIDR(r.spendIklan),
  },
  {
    key: "roas",
    header: "ROAS",
    numeric: true,
    render: (r) =>
      r.spendIklan > 0 ? formatMultiple(r.omset / r.spendIklan) : "—",
  },
];
