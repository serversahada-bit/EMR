"use client";

import { BarChart } from "@/components/BarChart";
import { Card } from "@/components/Card";
import { ChartFrame } from "@/components/ChartFrame";
import { DataTable, type Column } from "@/components/DataTable";
import { KpiCard } from "@/components/KpiCard";
import { LineChart } from "@/components/LineChart";
import { TintedList } from "@/components/Lists";
import { MonthPicker, labelBulan } from "@/components/MonthPicker";
import { PageHead } from "@/components/PageHead";
import { DeltaPill } from "@/components/Pill";
import { StackedBarChart } from "@/components/StackedBarChart";
import {
  IconCoins,
  IconDocument,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import type {
  OmsetBulan,
  OmsetHarian,
  OmsetPerAdv,
  OmsetRingkas,
  MutuData,
} from "@/data/omset-queries";
import {
  formatCompact,
  formatCount,
  formatIDR,
  formatIDRPenuh,
  formatNumber,
  formatPercent,
} from "@/lib/format";

export interface OmsetData {
  bulan: string;
  bulanTersedia: string[];
  harian: OmsetHarian[];
  ringkas: OmsetRingkas;
  ringkasSebelum: OmsetRingkas | null;
  bulanSebelum: string | null;
  tren: OmsetBulan[];
  perAdv: OmsetPerAdv[];
  customerBaru: number;
  customerBaruSebelum: number | null;
  mutu: MutuData;
}

export function OmsetView({ data }: { data: OmsetData }) {
  const {
    bulan,
    bulanTersedia,
    harian,
    ringkas,
    ringkasSebelum,
    bulanSebelum,
    tren,
    perAdv,
    customerBaru,
    customerBaruSebelum,
    mutu,
  } = data;

  const delta = (kini: number, lalu: number | null | undefined) =>
    lalu ? ((kini - lalu) / Math.abs(lalu)) * 100 : null;

  const hariKategori = harian.map((row) => ({
    label: row.hari,
    longLabel: row.hari + " " + labelBulan(bulan),
  }));

  const trenKategori = tren.map((row) => ({
    label: labelBulan(row.bulan).slice(0, 3),
    longLabel: labelBulan(row.bulan),
  }));

  const pembanding = bulanSebelum
    ? "vs " + labelBulan(bulanSebelum)
    : "tanpa pembanding";

  /* Diskon mengurangi omset, jadi ditampilkan terpisah, bukan
     sebagai bagian dari komposisi yang menjumlah ke total. */
  const komponen = [
    { id: "harga", label: "Harga barang", nilai: ringkas.harga, slot: 1 },
    { id: "ongkir", label: "Ongkir", nilai: ringkas.ongkir, slot: 2 },
    { id: "fee", label: "Fee", nilai: ringkas.fee, slot: 3 },
  ];
  const bruto = ringkas.harga + ringkas.ongkir + ringkas.fee;

  /* Alarm impor sengaja senyap untuk kerusakan kecil. Satu baris rusak
     dari 4.244 transaksi menggeser omset ~0,06%; banner yang tampil tiap
     bulan untuk angka sebesar itu hanya melatih pembaca mengabaikannya,
     sehingga justru mati saat kerusakan yang sesungguhnya datang.
     Ambang relatif menjaga bulan berdata sedikit tetap sensitif. */
  const imporRusakParah =
    mutu.barisUangTidakValid >= 10 ||
    mutu.barisUangTidakValid > ringkas.transaksi * 0.005;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <PageHead
          title="Omset"
          subtitle={
            "Data operasional riil dari tabel data_transaksi · " +
            labelBulan(bulan)
          }
        />
        <div className="mb-5">
          <MonthPicker
            nilai={bulan}
            pilihan={bulanTersedia}
            basePath="/omset"
          />
        </div>
      </div>

      {harian.length === 0 ? (
        <p className="mb-5 rounded-xl border border-hairline bg-surface px-4 py-3 text-xs text-ink-2">
          Belum ada transaksi untuk {labelBulan(bulan)}. Angka bulan ini akan
          muncul setelah data transaksi tersedia.
        </p>
      ) : null}

      {imporRusakParah ? (
        <div
          className="mb-5 rounded-xl px-4 py-3 text-xs leading-relaxed text-ink-2"
          style={{ background: "var(--warning-bg)" }}
        >
          <strong className="font-semibold text-ink">Impor bermasalah.</strong>{" "}
          <strong className="font-semibold text-ink">
            {formatNumber(mutu.barisUangTidakValid)} dari{" "}
            {formatNumber(ringkas.transaksi)} baris
          </strong>{" "}
          {labelBulan(bulan)} punya kolom uang yang tidak terbaca sebagai angka,
          sehingga MySQL menghitungnya nol atau memotongnya. Omset bulan ini{" "}
          <strong className="font-semibold text-ink">lebih rendah</strong>{" "}
          daripada semestinya — periksa proses impor sebelum angka ini dipakai.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Omset"
          value={formatIDRPenuh(ringkas.omset)}
          icon={IconCoins}
          tint="var(--tint-s1)"
          color="var(--s1)"
          delta={delta(ringkas.omset, ringkasSebelum?.omset)}
          comparison={pembanding}
          trend={tren.map((row) => row.omset)}
        />
        <KpiCard
          label="Transaksi"
          value={formatNumber(ringkas.transaksi)}
          icon={IconDocument}
          tint="var(--tint-s3)"
          color="var(--s3)"
          delta={delta(ringkas.transaksi, ringkasSebelum?.transaksi)}
          comparison={pembanding}
          trend={tren.map((row) => row.transaksi)}
        />
        <KpiCard
          label="Barang terkirim"
          value={formatNumber(ringkas.barang)}
          icon={IconWallet}
          tint="var(--tint-s4)"
          color="var(--s4)"
          delta={delta(ringkas.barang, ringkasSebelum?.barang)}
          comparison={pembanding}
          trend={tren.map((row) => row.barang)}
        />
        <KpiCard
          label="Customer baru"
          value={formatNumber(customerBaru)}
          icon={IconUsers}
          tint="var(--tint-s2)"
          color="var(--s2)"
          delta={delta(customerBaru, customerBaruSebelum)}
          comparison={pembanding}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <ChartFrame
          className="lg:col-span-8"
          title="Omset harian"
          subtitle={labelBulan(bulan)}
          footnote="Omset = harga barang + ongkir + fee − diskon, mengikuti rumus laporan yang berjalan."
          chart={
            harian.length === 0 ? (
              <p className="flex h-56 items-center justify-center text-xs text-muted">
                Belum ada data harian untuk bulan ini.
              </p>
            ) : (
              <StackedBarChart
                categories={hariKategori}
                height={224}
                formatValue={(v) => formatIDR(v)}
                formatTick={(v) => formatCompact(v, 0)}
                totalLabel="Omset"
                series={[
                  {
                    id: "omset",
                    label: "Omset",
                    color: "var(--s1)",
                    values: harian.map((row) => row.omset),
                  },
                ]}
              />
            )
          }
          table={
            <DataTable
              rows={harian}
              rowKey={(row) => row.hari}
              columns={kolomHarian}
            />
          }
        />

        <Card className="p-5 lg:col-span-4">
          <h2 className="text-[15px] font-semibold leading-tight text-ink">
            Komposisi omset
          </h2>
          <p className="mt-1 text-xs text-muted">
            Bruto {formatIDR(bruto)} sebelum diskon
          </p>

          <div className="mt-4">
            <TintedList
              rows={komponen.map((item) => ({
                id: item.id,
                label: item.label,
                slot: item.slot,
                value: formatPercent(
                  bruto ? (item.nilai / bruto) * 100 : 0,
                  0,
                ),
              }))}
            />
          </div>

          <dl className="mt-4 space-y-2 border-t border-hairline pt-4 text-xs">
            {komponen.map((item) => (
              <div key={item.id} className="flex justify-between gap-3">
                <dt className="text-ink-2">{item.label}</dt>
                <dd className="tnum font-semibold text-ink">
                  {formatIDR(item.nilai)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">Diskon</dt>
              <dd
                className="tnum font-semibold"
                style={{ color: "var(--delta-down)" }}
              >
                −{formatIDR(ringkas.diskon)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-hairline pt-2">
              <dt className="font-semibold text-ink">Omset bersih</dt>
              <dd className="tnum font-semibold text-ink">
                {formatIDR(ringkas.omset)}
              </dd>
            </div>
          </dl>
        </Card>

        <ChartFrame
          className="lg:col-span-7"
          title="Tren omset bulanan"
          subtitle={tren.length + " bulan terakhir"}
          chart={
            <LineChart
              categories={trenKategori}
              height={196}
              zeroBased
              formatValue={(v) => formatIDR(v)}
              formatTick={(v) => formatCompact(v, 0)}
              series={[
                {
                  id: "omset",
                  label: "Omset",
                  color: "var(--s1)",
                  values: tren.map((row) => row.omset),
                  labelEnd: true,
                  area: true,
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

        <ChartFrame
          className="lg:col-span-5"
          title="Omset per ADV / kanal"
          subtitle="Isi kolom adv apa adanya — campuran kode advertiser dan nama kanal"
          footnote="Sumber di luar 10 besar dilipat menjadi satu baris “Lainnya”, tidak dibuang."
          chart={
            <BarChart
              rows={perAdv.map((row) => ({
                id: row.adv,
                label: row.adv,
                value: row.omset,
              }))}
              formatValue={(v) => formatIDR(v)}
              labelWidth={132}
            />
          }
          table={
            <DataTable
              rows={perAdv}
              rowKey={(row) => row.adv}
              columns={kolomAdv}
            />
          }
        />
      </div>

      {ringkasSebelum && bulanSebelum ? (
        <Card className="mt-4 p-5">
          <h2 className="text-[15px] font-semibold leading-tight text-ink">
            Perbandingan dengan {labelBulan(bulanSebelum)}
          </h2>
          <dl className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Omset", ringkas.omset, ringkasSebelum.omset, true],
              ["Transaksi", ringkas.transaksi, ringkasSebelum.transaksi, false],
              ["Barang", ringkas.barang, ringkasSebelum.barang, false],
              ["Diskon", ringkas.diskon, ringkasSebelum.diskon, true],
            ].map(([label, kini, lalu, uang]) => (
              <div key={String(label)}>
                <dt className="text-[11px] uppercase tracking-wider text-muted">
                  {String(label)}
                </dt>
                <dd className="tnum mt-1 text-sm font-semibold text-ink">
                  {uang
                    ? formatIDR(Number(kini))
                    : formatCount(Number(kini))}
                </dd>
                <dd className="mt-1.5">
                  <DeltaPill
                    value={delta(Number(kini), Number(lalu))}
                    upIsGood={label !== "Diskon"}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}
    </>
  );
}

const kolomHarian: Column<OmsetHarian>[] = [
  { key: "hari", header: "Tgl", render: (r) => r.hari },
  {
    key: "omset",
    header: "Omset",
    numeric: true,
    render: (r) => formatIDR(r.omset),
  },
  {
    key: "harga",
    header: "Harga",
    numeric: true,
    render: (r) => formatIDR(r.harga),
  },
  {
    key: "ongkir",
    header: "Ongkir",
    numeric: true,
    render: (r) => formatIDR(r.ongkir),
  },
  {
    key: "fee",
    header: "Fee",
    numeric: true,
    render: (r) => formatIDR(r.fee),
  },
  {
    key: "diskon",
    header: "Diskon",
    numeric: true,
    render: (r) => formatIDR(r.diskon),
  },
  {
    key: "transaksi",
    header: "Trx",
    numeric: true,
    render: (r) => formatNumber(r.transaksi),
  },
  {
    key: "barang",
    header: "Barang",
    numeric: true,
    render: (r) => formatNumber(r.barang),
  },
];

const kolomTren: Column<OmsetBulan>[] = [
  { key: "bulan", header: "Bulan", render: (r) => labelBulan(r.bulan) },
  {
    key: "omset",
    header: "Omset",
    numeric: true,
    render: (r) => formatIDR(r.omset),
  },
  {
    key: "transaksi",
    header: "Transaksi",
    numeric: true,
    render: (r) => formatNumber(r.transaksi),
  },
  {
    key: "barang",
    header: "Barang",
    numeric: true,
    render: (r) => formatNumber(r.barang),
  },
];

const kolomAdv: Column<OmsetPerAdv>[] = [
  { key: "adv", header: "ADV / kanal", render: (r) => r.adv },
  {
    key: "omset",
    header: "Omset",
    numeric: true,
    render: (r) => formatIDR(r.omset),
  },
  {
    key: "transaksi",
    header: "Transaksi",
    numeric: true,
    render: (r) => formatNumber(r.transaksi),
  },
];
