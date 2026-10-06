"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Card, CardHead } from "@/components/Card";
import { DataTable, type Column } from "@/components/DataTable";
import { labelBulan } from "@/components/MonthPicker";
import { PageHead } from "@/components/PageHead";
import type { SpendHarian } from "@/data/meta-queries";
import { formatIDR, formatIDRPenuh, formatNumber } from "@/lib/format";

export interface SpendData {
  sumberId: string;
  sumberLabel: string;
  sumber: { id: string; label: string }[];
  bulan: string;
  bulanTersedia: string[];
  harian: SpendHarian[];
}

const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** "2026-10-01" → "01 Okt · Kam" */
function labelTanggal(tanggal: string): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  const hari = NAMA_HARI[new Date(Date.UTC(t, b - 1, h)).getUTCDay()];
  return `${String(h).padStart(2, "0")} ${labelBulan(tanggal).slice(0, 3)} · ${hari}`;
}

export function SpendView({ data }: { data: SpendData }) {
  const { sumberId, sumberLabel, sumber, bulan, bulanTersedia, harian } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /* Kedua pilihan dibawa bersama di URL; mengganti salah satunya tidak
     boleh menghapus yang lain. */
  const pindah = (sumberBaru: string, bulanBaru: string) =>
    startTransition(() => {
      router.push(`/meta/spend-iklan?sumber=${sumberBaru}&bulan=${bulanBaru}`);
    });

  const totalSpend = harian.reduce((a, r) => a + r.spend, 0);
  const totalLead = harian.reduce((a, r) => a + r.lead, 0);
  const totalKlik = harian.reduce((a, r) => a + r.klik, 0);
  const cpl = totalLead > 0 ? totalSpend / totalLead : null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <PageHead
          title="Tabel spend iklan"
          subtitle={`Belanja iklan per tanggal · ${sumberLabel} · ${labelBulan(bulan)}`}
        />

        <div className="no-print mb-5 flex flex-wrap items-center gap-4">
          <Pilih
            id="sumber"
            label="Sumber"
            nilai={sumberId}
            pending={pending}
            pilihan={sumber.map((s) => ({ nilai: s.id, teks: s.label }))}
            onChange={(v) => pindah(v, bulan)}
          />
          <Pilih
            id="bulan"
            label="Bulan"
            nilai={bulan}
            pending={pending}
            pilihan={bulanTersedia.map((b) => ({
              nilai: b,
              teks: labelBulan(b),
            }))}
            onChange={(v) => pindah(sumberId, v)}
          />
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Ringkas label="Total spend" nilai={formatIDRPenuh(totalSpend)} />
        <Ringkas label="Total lead" nilai={formatNumber(totalLead)} />
        <Ringkas
          label="Biaya per lead"
          nilai={cpl === null ? "—" : formatIDRPenuh(cpl)}
        />
        <Ringkas label="Hari tercatat" nilai={formatNumber(harian.length)} />
      </div>

      <Card>
        <CardHead
          title="Rincian harian"
          subtitle={`${sumberLabel} · ${labelBulan(bulan)} · ${formatNumber(totalKlik)} klik tautan`}
        />
        <div className="px-5 pb-5">
          {harian.length === 0 ? (
            <p className="py-8 text-center text-xs text-ink-2">
              Tidak ada baris untuk {sumberLabel} pada {labelBulan(bulan)}.
            </p>
          ) : (
            <DataTable
              rows={harian}
              rowKey={(row) => row.tanggal}
              columns={kolom}
            />
          )}
        </div>
      </Card>
    </>
  );
}

function Ringkas({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface px-5 py-4">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className="tnum mt-1.5 text-lg font-semibold leading-none text-ink">
        {nilai}
      </p>
    </div>
  );
}

function Pilih({
  id,
  label,
  nilai,
  pilihan,
  pending,
  onChange,
}: {
  id: string;
  label: string;
  nilai: string;
  pilihan: { nilai: string; teks: string }[];
  pending: boolean;
  onChange: (nilai: string) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted"
      >
        {label}
      </label>
      <select
        id={id}
        value={nilai}
        disabled={pending}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-60"
      >
        {pilihan.map((p) => (
          <option key={p.nilai} value={p.nilai}>
            {p.teks}
          </option>
        ))}
      </select>
    </div>
  );
}

const kolom: Column<SpendHarian>[] = [
  {
    key: "tanggal",
    header: "Tanggal",
    render: (r) => labelTanggal(r.tanggal),
  },
  {
    key: "spend",
    header: "Spend iklan",
    numeric: true,
    render: (r) => formatIDRPenuh(r.spend),
  },
  {
    key: "klik",
    header: "Klik tautan",
    numeric: true,
    render: (r) => formatNumber(r.klik),
  },
  {
    key: "lead",
    header: "Lead",
    numeric: true,
    render: (r) => formatNumber(r.lead),
  },
  {
    key: "cpl",
    header: "Biaya per lead",
    numeric: true,
    render: (r) => (r.lead > 0 ? formatIDR(r.spend / r.lead) : "—"),
  },
];
