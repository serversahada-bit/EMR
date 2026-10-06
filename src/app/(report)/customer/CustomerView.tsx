"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Card, CardHead } from "@/components/Card";
import { DataTable, type Column } from "@/components/DataTable";
import { PageHead } from "@/components/PageHead";
import type {
  BarisCustomer,
  HalamanCustomer,
  RingkasCustomer,
} from "@/data/customer-queries";
import { formatNumber, formatPercent } from "@/lib/format";

export interface CustomerData {
  ringkas: RingkasCustomer;
  halaman: HalamanCustomer;
  provinsiPilihan: string[];
  tahunPilihan: number[];
  cari: string;
  provinsi: string;
  tahun: string;
}

export function CustomerView({ data }: { data: CustomerData }) {
  const {
    ringkas,
    halaman,
    provinsiPilihan,
    tahunPilihan,
    cari,
    provinsi,
    tahun,
  } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kataKunci, setKataKunci] = useState(cari);

  const buka = (opsi: {
    cari?: string;
    provinsi?: string;
    tahun?: string;
    hal?: number;
  }) => {
    const p = new URLSearchParams();
    const c = opsi.cari ?? cari;
    const pr = opsi.provinsi ?? provinsi;
    const th = opsi.tahun ?? tahun;
    if (c) p.set("cari", c);
    if (pr) p.set("provinsi", pr);
    if (th) p.set("tahun", th);
    if (opsi.hal && opsi.hal > 1) p.set("hal", String(opsi.hal));
    startTransition(() => router.push("/customer?" + p.toString()));
  };

  const porsiRepeat =
    ringkas.total > 0 ? (ringkas.pernahRepeat / ringkas.total) * 100 : 0;

  const awal = (halaman.halaman - 1) * 100 + 1;
  const akhir = Math.min(halaman.halaman * 100, halaman.total);

  return (
    <>
      <PageHead
        title="Data customer"
        subtitle={`${formatNumber(ringkas.total)} customer terdaftar di data_customer`}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Ringkas label="Total customer" nilai={formatNumber(ringkas.total)} />
        <Ringkas
          label="Pernah beli ulang"
          nilai={formatNumber(ringkas.pernahRepeat)}
          catatan={formatPercent(porsiRepeat) + " dari total"}
        />
        {ringkas.provinsiTeratas.slice(0, 2).map((p) => (
          <Ringkas
            key={p.provinsi}
            label={p.provinsi}
            nilai={formatNumber(p.jumlah)}
            catatan="provinsi terbanyak"
          />
        ))}
      </div>

      <Card>
        <CardHead
          title="Daftar customer"
          subtitle={
            halaman.total === 0
              ? "Tidak ada yang cocok"
              : `Menampilkan ${formatNumber(awal)}–${formatNumber(akhir)} dari ${formatNumber(halaman.total)}`
          }
        />

        <div className="no-print flex flex-wrap items-end gap-3 px-5 pb-4">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              buka({ cari: kataKunci, hal: 1 });
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                Cari nama atau HP
              </span>
              <input
                value={kataKunci}
                onChange={(e) => setKataKunci(e.target.value)}
                placeholder="mis. Fitri atau 628123"
                className="w-56 rounded-lg border border-hairline bg-page px-3 py-1.5 text-xs text-ink outline-none placeholder:text-muted focus:border-ink-2"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              style={{ background: "var(--s1)" }}
            >
              Cari
            </button>
          </form>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Provinsi
            </span>
            <select
              value={provinsi}
              disabled={pending}
              onChange={(e) => buka({ provinsi: e.target.value, hal: 1 })}
              className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-60"
            >
              <option value="">Semua provinsi</option>
              {provinsiPilihan.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Tahun daftar
            </span>
            <select
              value={tahun}
              disabled={pending}
              onChange={(e) => buka({ tahun: e.target.value, hal: 1 })}
              className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-60"
            >
              <option value="">Semua tahun</option>
              {tahunPilihan.map((t) => (
                <option key={t} value={String(t)}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          {cari || provinsi || tahun ? (
            <button
              type="button"
              onClick={() => {
                setKataKunci("");
                startTransition(() => router.push("/customer"));
              }}
              className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-2"
            >
              Reset
            </button>
          ) : null}
        </div>

        <div className="px-5 pb-5">
          {halaman.baris.length === 0 ? (
            <p className="py-8 text-center text-xs text-ink-2">
              Tidak ada customer yang cocok dengan filter ini.
            </p>
          ) : (
            <>
              <DataTable
                rows={halaman.baris}
                rowKey={(row) => String(row.id)}
                columns={kolom}
              />

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={pending || halaman.halaman <= 1}
                  onClick={() => buka({ hal: halaman.halaman - 1 })}
                  className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-2 disabled:opacity-40"
                >
                  ← Sebelumnya
                </button>
                <span className="text-xs text-muted">
                  Halaman {formatNumber(halaman.halaman)} dari{" "}
                  {formatNumber(halaman.jumlahHalaman)}
                </span>
                <button
                  type="button"
                  disabled={
                    pending || halaman.halaman >= halaman.jumlahHalaman
                  }
                  onClick={() => buka({ hal: halaman.halaman + 1 })}
                  className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-2 disabled:opacity-40"
                >
                  Berikutnya →
                </button>
              </div>
            </>
          )}
        </div>
      </Card>
    </>
  );
}

function Ringkas({
  label,
  nilai,
  catatan,
}: {
  label: string;
  nilai: string;
  catatan?: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface px-5 py-4">
      <p className="truncate text-xs font-medium text-ink-2">{label}</p>
      <p className="tnum mt-1.5 text-lg font-semibold leading-none text-ink">
        {nilai}
      </p>
      {catatan ? (
        <p className="mt-1.5 text-[11px] text-muted">{catatan}</p>
      ) : null}
    </div>
  );
}

const kolom: Column<BarisCustomer>[] = [
  { key: "nama", header: "Nama", render: (r) => r.nama || "—" },
  { key: "hp", header: "No. HP", render: (r) => r.hp || "—" },
  { key: "kab", header: "Kabupaten/Kota", render: (r) => r.kabupaten || "—" },
  { key: "prov", header: "Provinsi", render: (r) => r.provinsi || "—" },
  {
    key: "reg",
    header: "Terdaftar",
    render: (r) => r.tglReg ?? "—",
  },
  {
    key: "ro",
    header: "Beli ulang",
    numeric: true,
    render: (r) => (r.roCount > 0 ? formatNumber(r.roCount) : "—"),
  },
  { key: "adv", header: "ADV", render: (r) => r.adv || "—" },
];
