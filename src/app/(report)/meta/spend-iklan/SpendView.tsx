"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Card, CardHead } from "@/components/Card";
import { DataTable, type Column } from "@/components/DataTable";
import { labelBulan } from "@/components/MonthPicker";
import { PageHead } from "@/components/PageHead";
import { formatIDR, formatIDRPenuh, formatNumber } from "@/lib/format";

/** Bentuk satu baris harian; sengaja didefinisikan di sini, bukan diimpor
    dari meta-queries, supaya rute Google bisa memakai komponen yang sama. */
export interface SpendRow {
  tanggal: string;
  spend: number;
  klik: number;
  lead: number;
  baris: number;
  /* Hanya terisi untuk Marketplace: kanal itu tidak punya klik/lead,
     dan sebaliknya punya omset/box/pesanan yang tidak ada di kanal
     iklan. Kolom tabel dipilih berdasarkan platformLabel. */
  omset?: number;
  box?: number;
  pesanan?: number;
}

/** Satu kartu produk pada pemilih di atas tabel. */
export interface ProdukPilihan {
  /** Slug nama produk; ikut ke URL sebagai `?produk=`. */
  id: string;
  label: string;
  /** Gambar kecil dari halaman setingan produk, bila sudah diunggah. */
  gambar?: string | null;
  /** Benar bila produk ini belum punya tabel spend di platform tersebut. */
  kosong?: boolean;
}

/** "Meta Ads" / "Google Ads" — dipakai pada pesan saat belum ada tabel. */
export type PlatformLabel =
  | "Meta Ads"
  | "Google Ads"
  | "Snack Video"
  | "Marketplace";

export interface SpendData {
  produkId: string;
  produkLabel: string;
  produk: ProdukPilihan[];
  platformLabel: PlatformLabel;
  /** Produk terpilih belum punya satu pun tabel spend di platform ini. */
  produkKosong: boolean;
  bulan: string;
  bulanTersedia: string[];
  harian: SpendRow[];
  /** Tabel yang menyumbang baris — satu produk bisa punya beberapa. */
  tabelDipakai: string[];
  /** Rute halaman ini, mis. "/meta/spend-iklan" -- dipakai saat pindah filter. */
  basePath: string;
}

const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** "2026-10-01" → "01 Okt · Kam" */
function labelTanggal(tanggal: string): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  const hari = NAMA_HARI[new Date(Date.UTC(t, b - 1, h)).getUTCDay()];
  return `${String(h).padStart(2, "0")} ${labelBulan(tanggal).slice(0, 3)} · ${hari}`;
}

export function SpendView({ data }: { data: SpendData }) {
  const {
    produkId,
    produkLabel,
    produk,
    platformLabel,
    produkKosong,
    bulan,
    bulanTersedia,
    harian,
    tabelDipakai,
    basePath,
  } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /* Kedua pilihan dibawa bersama di URL; mengganti salah satunya tidak
     boleh menghapus yang lain. */
  const pindah = (produkBaru: string, bulanBaru: string) =>
    startTransition(() => {
      router.push(`${basePath}?produk=${produkBaru}&bulan=${bulanBaru}`);
    });

  const totalSpend = harian.reduce((a, r) => a + r.spend, 0);
  const totalLead = harian.reduce((a, r) => a + r.lead, 0);
  const totalKlik = harian.reduce((a, r) => a + r.klik, 0);
  const cpl = totalLead > 0 ? totalSpend / totalLead : null;
  /* Marketplace tidak punya klik/lead; nilainya ada di omset/box. */
  const mp = platformLabel === "Marketplace";
  const totalOmset = harian.reduce((a, r) => a + (r.omset ?? 0), 0);
  const totalBox = harian.reduce((a, r) => a + (r.box ?? 0), 0);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <PageHead
          title="Tabel spend iklan"
          subtitle={`Belanja iklan per tanggal · ${produkLabel} · ${labelBulan(bulan)}`}
        />

        <div className="no-print mb-5 flex flex-wrap items-center gap-4">
          <Pilih
            id="bulan"
            label="Bulan"
            nilai={bulan}
            pending={pending}
            pilihan={bulanTersedia.map((b) => ({
              nilai: b,
              teks: labelBulan(b),
            }))}
            onChange={(v) => pindah(produkId, v)}
          />
        </div>
      </div>

      <JejerProduk
        nilai={produkId}
        pilihan={produk}
        pending={pending}
        onChange={(v) => pindah(v, bulan)}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Ringkas label="Total spend" nilai={formatIDRPenuh(totalSpend)} />
        {mp ? (
          <>
            <Ringkas label="Omset" nilai={formatIDRPenuh(totalOmset)} />
            <Ringkas
              label="Omset / spend"
              nilai={
                totalSpend > 0
                  ? `${(totalOmset / totalSpend).toFixed(2)}×`
                  : "—"
              }
            />
            <Ringkas label="Box" nilai={formatNumber(totalBox)} />
          </>
        ) : (
          <>
            <Ringkas label="Total lead" nilai={formatNumber(totalLead)} />
            <Ringkas
              label="Biaya per lead"
              nilai={cpl === null ? "—" : formatIDRPenuh(cpl)}
            />
            <Ringkas label="Hari tercatat" nilai={formatNumber(harian.length)} />
          </>
        )}
      </div>

      <Card>
        <CardHead
          title="Rincian harian"
          subtitle={
            `${produkLabel} · ${labelBulan(bulan)} · ` +
            (mp
              ? `${formatNumber(harian.length)} hari tercatat`
              : `${formatNumber(totalKlik)} klik tautan`) +
            /* Tabel asalnya disebut di sini, bukan di kartu produk:
               kartunya satu per produk, sedangkan angkanya bisa datang
               dari beberapa tabel sekaligus. */
            (tabelDipakai.length > 0 ? ` · ${tabelDipakai.join(", ")}` : "")
          }
        />
        <div className="px-5 pb-5">
          {harian.length === 0 ? (
            /* Dua sebab yang berbeda, dan pemakai perlu tahu yang mana:
               tabelnya belum ada sama sekali, atau tabelnya ada tapi
               bulan itu kosong. */
            <p className="mx-auto max-w-lg py-8 text-center text-xs leading-relaxed text-ink-2">
              {produkKosong ? (
                <>
                  {produkLabel} belum punya tabel spend di {platformLabel}.
                  Tabel baru terbaca sendiri begitu dibuat di database; kalau
                  datanya sudah ada dengan nama tabel lain, tautkan lewat{" "}
                  <strong className="font-semibold text-ink">
                    Setingan produk
                  </strong>
                  .
                </>
              ) : (
                <>
                  Tidak ada baris untuk {produkLabel} pada {labelBulan(bulan)}.
                </>
              )}
            </p>
          ) : (
            <DataTable
              rows={harian}
              rowKey={(row) => row.tanggal}
              columns={mp ? kolomMarketplace : kolom}
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

/**
 * Produk berjejer sebagai kartu pemilih.
 *
 * Satu kartu satu produk — bukan satu tabel. Tahun tabelnya sudah
 * ditentukan pemilih bulan di atas, jadi "Gamamilk 2024/2025/2026"
 * tidak perlu jadi tiga kartu.
 *
 * Bingkainya sama dengan kartu ringkasan di bawahnya supaya keduanya
 * terbaca sebagai satu blok.
 */
function JejerProduk({
  nilai,
  pilihan,
  pending,
  onChange,
}: {
  nilai: string;
  pilihan: ProdukPilihan[];
  pending: boolean;
  onChange: (nilai: string) => void;
}) {
  if (pilihan.length === 0) return null;

  return (
    <div className="no-print mb-4 flex flex-wrap gap-3">
      {pilihan.map((p) => {
        const aktif = p.id === nilai;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={aktif}
            disabled={pending}
            /* Produk tanpa tabel tetap bisa dibuka — halamannya yang
               menjelaskan kenapa kosong. Kartu mati tanpa keterangan
               malah bikin orang mengira halamannya rusak. */
            title={
              p.kosong
                ? `${p.label} belum punya tabel spend di halaman ini`
                : undefined
            }
            onClick={() => {
              if (!aktif) onChange(p.id);
            }}
            className={
              "flex min-w-40 flex-1 items-center gap-3 rounded-2xl border px-5 py-4 text-left " +
              (aktif ? "border-transparent " : "border-hairline bg-surface ") +
              (p.kosong && !aktif ? "opacity-60" : "") +
              " disabled:opacity-60"
            }
            /* Warna terpilih diambil dari token tema, bukan kelas
               Tailwind: nilainya sudah dipakai grafik di halaman lain. */
            style={
              aktif
                ? { borderColor: "var(--s1)", background: "var(--tint-s1)" }
                : undefined
            }
          >
            <GambarProduk produk={p} ukuran={34} />
            <span className="min-w-0 text-sm font-semibold leading-tight text-ink">
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Gambar produk, atau inisialnya selama gambarnya belum diunggah.
 *
 * Memakai <img> biasa, bukan next/image: sumbernya data URL dari
 * database, jadi tidak ada yang bisa dioptimalkan pengoptimal gambar.
 */
function GambarProduk({
  produk,
  ukuran,
}: {
  produk: ProdukPilihan;
  ukuran: number;
}) {
  const gaya = { width: ukuran, height: ukuran };

  if (produk.gambar) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={produk.gambar}
        alt=""
        style={gaya}
        className="shrink-0 rounded-md object-cover"
      />
    );
  }

  return (
    <span
      style={gaya}
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-md bg-sunken text-[10px] font-semibold text-muted"
    >
      {produk.label.slice(0, 2).toUpperCase()}
    </span>
  );
}

/* Marketplace memakai kolom yang berbeda: tidak ada klik/lead di sana,
   dan omset/box/pesanan tidak ada di kanal iklan. Dipilih lewat
   platformLabel supaya sisa komponen -- chip produk, pemilih bulan,
   pesan kosong -- tetap sama persis untuk semua kanal. */
const kolomMarketplace: Column<SpendRow>[] = [
  {
    key: "tanggal",
    header: "Tanggal",
    render: (r) => labelTanggal(r.tanggal),
  },
  {
    key: "spend",
    header: "Total spend",
    numeric: true,
    render: (r) => formatIDRPenuh(r.spend),
  },
  {
    key: "omset",
    header: "Omset",
    numeric: true,
    render: (r) => formatIDRPenuh(r.omset ?? 0),
  },
  {
    key: "rasio",
    header: "Omset / spend",
    numeric: true,
    render: (r) =>
      r.spend > 0 ? `${((r.omset ?? 0) / r.spend).toFixed(2)}×` : "—",
  },
  {
    key: "box",
    header: "Box",
    numeric: true,
    render: (r) => formatNumber(r.box ?? 0),
  },
  {
    key: "pesanan",
    header: "Pesanan",
    numeric: true,
    render: (r) => formatNumber(r.pesanan ?? 0),
  },
];

const kolom: Column<SpendRow>[] = [
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
