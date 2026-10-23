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
  PotongPeriode,
  RingkasDashboard,
  TitikTren,
} from "@/data/dashboard-queries";
import {
  formatIDR,
  formatIDRPenuh,
  formatMultiple,
  formatNumber,
  formatPercent,
  formatTickCompact,
} from "@/lib/format";

export interface DashboardData {
  bulan: string;
  bulanTersedia: string[];
  ringkas: RingkasDashboard;
  ringkasSebelum: RingkasDashboard | null;
  bulanSebelum: string | null;
  /** Rentang tanggal pembanding bila bulan ini belum selesai; null = penuh. */
  potong: PotongPeriode | null;
  tren: TitikTren[];
  channel: OmsetChannel[];
}

/** Pembagian aman: penyebut 0 berarti rasionya tidak terdefinisi. */
const bagi = (atas: number, bawah: number): number | null =>
  bawah > 0 ? atas / bawah : null;

/**
 * COS = biaya pemasaran ÷ omset, dengan omset yang dipotong di hari
 * terakhir data biaya (`omsetSebanding`). Bulan tanpa data biaya sama
 * sekali tidak punya COS — 0% di situ akan terbaca sebagai "gratis".
 */
const cosDari = (r: { spendIklan: number; omsetSebanding: number }) =>
  r.spendIklan > 0 ? bagi(r.spendIklan, r.omsetSebanding) : null;

export function DashboardView({ data }: { data: DashboardData }) {
  const {
    bulan,
    bulanTersedia,
    ringkas,
    ringkasSebelum,
    bulanSebelum,
    potong,
    tren,
    channel,
  } = data;

  const delta = (ambil: (r: RingkasDashboard) => number): number | null => {
    if (!ringkasSebelum) return null;
    const lalu = ambil(ringkasSebelum);
    return lalu ? ((ambil(ringkas) - lalu) / Math.abs(lalu)) * 100 : null;
  };

  const cos = cosDari(ringkas);
  const cosLalu = ringkasSebelum ? cosDari(ringkasSebelum) : null;
  const roas = cos ? 1 / cos : null;

  const akuisisi = bagi(ringkas.spendIklan, ringkas.customerBaru);
  const akuisisiLalu = ringkasSebelum
    ? bagi(ringkasSebelum.spendIklan, ringkasSebelum.customerBaru)
    : null;

  /* "vs 1–22 September 2026" saat bulan ini belum selesai, "vs September
     2026" saat sudah lengkap. Batas tanggalnya per sumber data: transaksi
     dan biaya pemasaran tidak terisi sampai tanggal yang sama. */
  const labelPembanding = (hari: number | undefined): string => {
    if (!bulanSebelum) return "tanpa pembanding";
    const nama = labelBulan(bulanSebelum);
    return potong && hari !== undefined && hari < potong.jumlahHari
      ? `vs 1–${hari} ${nama}`
      : `vs ${nama}`;
  };
  const pembandingTransaksi = labelPembanding(potong?.hariTransaksi);
  const pembandingBiaya = labelPembanding(potong?.hariBiaya);

  const kategori = tren.map((t) => ({
    label: labelBulan(t.bulan).slice(0, 3),
    longLabel: labelBulan(t.bulan),
  }));

  const aov = bagi(ringkas.omset, ringkas.transaksi);

  const pembandingCos =
    pembandingBiaya +
    (ringkas.targetCos !== null
      ? " · target " + formatPercent(ringkas.targetCos * 100)
      : "");

  /* Data biaya sering tertinggal dari data transaksi. COS sudah dihitung
     terhadap omset dengan cut-off yang sama, tapi biaya akuisisi customer
     belum — pembilang dan penyebutnya beda jumlah hari. */
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
            Data biaya pemasaran belum lengkap.
          </strong>{" "}
          Transaksi sudah sampai {ringkas.hariTerakhirTransaksi}, sedangkan
          biaya pemasaran baru sampai {ringkas.hariTerakhirIklan}. COS bulan
          ini sudah dihitung terhadap omset sampai {ringkas.hariTerakhirIklan}{" "}
          agar sebanding, tapi biaya akuisisi customer masih{" "}
          <strong className="font-semibold text-ink">terlalu bagus</strong> —
          biayanya mencakup lebih sedikit hari daripada customer barunya.
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
          comparison={pembandingTransaksi}
          trend={tren.map((t) => t.omset)}
        />
        <KpiCard
          label="Biaya pemasaran"
          value={formatIDRPenuh(ringkas.spendIklan)}
          icon={IconMegaphone}
          tint="var(--tint-s3)"
          color="var(--s3)"
          delta={delta((r) => r.spendIklan)}
          /* Biaya naik bukan kabar baik dengan sendirinya — yang
             menentukan adalah COS di kartu sebelah. */
          upIsGood={false}
          comparison={pembandingBiaya}
          trend={tren.map((t) => t.spendIklan)}
        />
        <KpiCard
          label="COS (biaya ÷ omset)"
          value={cos === null ? "—" : formatPercent(cos * 100)}
          icon={IconDocument}
          tint="var(--tint-s4)"
          color="var(--s4)"
          /* Selisih dalam poin persen, bukan persen relatif: "40,4% → 43,8%"
             lebih jujur ditulis "+3,4 pp" daripada "+8,4%". */
          delta={cos !== null && cosLalu !== null ? (cos - cosLalu) * 100 : null}
          unit="pp"
          /* COS turun = lebih efisien. */
          upIsGood={false}
          comparison={pembandingCos}
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
          comparison={pembandingTransaksi}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <ChartFrame
          className="lg:col-span-8"
          title="Omset dan biaya pemasaran"
          subtitle="12 bulan terakhir"
          footnote="Biaya pemasaran = spend total sheet Cost of Sales semua produk: konversi (Meta, Google, marketplace, TikTok), sales promotion (CRM/CSO), dan MBC (Marcom). COS = biaya pemasaran ÷ omset."
          chart={
            <LineChart
              categories={kategori}
              height={224}
              zeroBased
              formatValue={(v) => formatIDR(v)}
              formatTick={formatTickCompact}
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
                  label: "Biaya pemasaran",
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
                ROAS (omset ÷ biaya)
              </dt>
              <dd className="tnum mt-1 text-sm font-semibold text-ink">
                {roas === null ? "—" : formatMultiple(roas)}
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
    header: "Biaya pemasaran",
    numeric: true,
    render: (r) => formatIDR(r.spendIklan),
  },
  {
    key: "cos",
    header: "COS",
    numeric: true,
    render: (r) => {
      const c = cosDari(r);
      return c === null ? "—" : formatPercent(c * 100);
    },
  },
];
