"use client";

import { BarChart } from "@/components/BarChart";
import { ChartFrame } from "@/components/ChartFrame";
import { DataTable, type Column } from "@/components/DataTable";
import { MonthPicker, labelBulan } from "@/components/MonthPicker";
import { PageHead } from "@/components/PageHead";
import { DeltaPill } from "@/components/Pill";
import { StackedBarChart } from "@/components/StackedBarChart";
import { KerangkaGrafik, Tunggu } from "@/components/Tunggu";
import type { BarisProduk, TrenProduk } from "@/data/analitik-queries";
import { formatCount, formatIDR, formatPercent, formatTickCompact } from "@/lib/format";

export interface ProdukData {
  bulan: string;
  tersedia: string[];
  sebelum: string | null;
  hari1N: number | null;
  produk: BarisProduk[];
  /** Produk bulan pembanding (1–N bila bulan berjalan). */
  lalu: BarisProduk[];
  /** Promise: tren 12 bulan menyusul setelah tabel tampil. null = gagal. */
  tren: Promise<TrenProduk[] | null>;
}

/** Lima warna kategori yang tersedia: empat produk terbesar + Lainnya. */
const WARNA = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)"];

interface BarisTabel extends BarisProduk {
  porsi: number;
  delta: number | null;
}

/** Tren: empat produk terbesar sepanjang 12 bulan, sisanya "Lainnya". */
function seriTrenDari(tren: TrenProduk[]) {
  const totalTren = new Map<string, number>();
  for (const t of tren) for (const [k, v] of Object.entries(t.perProduk)) totalTren.set(k, (totalTren.get(k) ?? 0) + v);
  const utama = [...totalTren.entries()]
    .filter(([k]) => k !== "Lainnya")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => k);
  return [
    ...utama.map((k, i) => ({ id: k, label: k, color: WARNA[i], values: tren.map((t) => t.perProduk[k] ?? 0) })),
    {
      id: "lain",
      label: "Lainnya",
      color: WARNA[4],
      values: tren.map((t) => Object.entries(t.perProduk).filter(([k]) => !utama.includes(k)).reduce((a, [, v]) => a + v, 0)),
    },
  ];
}

export function ProdukView({ data }: { data: ProdukData }) {
  const { bulan, tersedia, sebelum, hari1N, produk, lalu, tren } = data;
  const total = produk.reduce((a, p) => a + p.omset, 0);
  const petaLalu = new Map(lalu.map((p) => [p.produk, p.omset]));
  const pembanding = sebelum ? `${hari1N ? `1–${hari1N} ` : ""}${labelBulan(sebelum)}` : null;

  /* "Lainnya" (hadiah, mug, salah input) hanya berisi bonus — tidak
     ditampilkan di grafik omset, tetap ada di tabel. */
  const berOmset = produk.filter((p) => p.omset > 0 && p.produk !== "Lainnya");
  const baris: BarisTabel[] = produk.map((p) => {
    const l = petaLalu.get(p.produk);
    return { ...p, porsi: total > 0 ? p.omset / total : 0, delta: l ? ((p.omset - l) / Math.abs(l)) * 100 : null };
  });

  const kolom: Column<BarisTabel>[] = [
    { key: "p", header: "Produk", render: (r) => r.produk },
    { key: "o", header: "Omset", numeric: true, render: (r) => formatIDR(r.omset) },
    { key: "s", header: "Porsi", numeric: true, render: (r) => formatPercent(r.porsi * 100) },
    {
      key: "d",
      header: pembanding ? `vs ${pembanding}` : "vs bulan lalu",
      numeric: true,
      render: (r) => <DeltaPill value={r.delta} />,
    },
    { key: "b", header: "Box berbayar", numeric: true, render: (r) => formatCount(r.box) },
    { key: "bb", header: "Box bonus", numeric: true, render: (r) => (r.boxBonus > 0 ? formatCount(r.boxBonus) : "—") },
    { key: "n", header: "Pesanan", numeric: true, render: (r) => formatCount(r.pesanan) },
    { key: "r", header: "Omset per box", numeric: true, render: (r) => (r.box > 0 ? formatIDR(r.omset / r.box) : "—") },
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <PageHead title="Produk" subtitle={`Performa per produk · ${labelBulan(bulan)} · dari data transaksi`} />
        <div className="mb-5">
          <MonthPicker nilai={bulan} pilihan={tersedia} basePath="/dashboard/produk" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <ChartFrame
          className="lg:col-span-5"
          title="Kontribusi omset"
          subtitle={`${labelBulan(bulan)} · total ${formatIDR(total)}`}
          chart={
            <BarChart rows={berOmset.map((p) => ({ id: p.produk, label: p.produk, value: p.omset }))} formatValue={(v) => formatIDR(v)} />
          }
          table={<DataTable rows={baris} rowKey={(r) => r.produk} columns={kolom.slice(0, 3)} />}
        />
        <Tunggu
          janji={tren}
          cadangan={<KerangkaGrafik className="lg:col-span-7" judul="Tren omset per produk" sub="12 bulan terakhir" tinggi={240} />}
        >
          {(tr) => {
            if (!tr) {
              return <div className="rounded-2xl border border-hairline bg-surface p-5 text-sm text-ink-2 lg:col-span-7">Tren produk gagal dimuat. Coba muat ulang halaman.</div>;
            }
            const seri = seriTrenDari(tr);
            return (
                    <ChartFrame
                      className="lg:col-span-7"
                      title="Tren omset per produk"
                      subtitle="12 bulan terakhir"
                      chart={
                        <StackedBarChart
                          categories={tr.map((t) => ({ label: labelBulan(t.bulan).slice(0, 3), longLabel: labelBulan(t.bulan) }))}
                          series={seri}
                          height={240}
                          formatValue={(v) => formatIDR(v)}
                          formatTick={formatTickCompact}
                        />
                      }
                      table={
                        <DataTable
                          rows={tr}
                          rowKey={(r) => r.bulan}
                          columns={[
                            { key: "b", header: "Bulan", render: (r) => labelBulan(r.bulan) },
                            ...seri.map((s) => ({
                              key: s.id,
                              header: s.label,
                              numeric: true,
                              render: (r: TrenProduk) => formatIDR(s.values[tr.indexOf(r)]),
                            })),
                          ]}
                        />
                      }
                    />
            );
          }}
        </Tunggu>
      </div>

      <div className="mt-4 rounded-2xl border border-hairline bg-surface">
        <div className="px-5 pt-5">
          <h2 className="text-[15px] font-semibold leading-tight text-ink">Rincian per produk</h2>
          <p className="mt-1 text-xs text-muted">
            Satu pesanan bisa berisi beberapa produk: omsetnya dibagi ke tiap produk menurut porsi harganya. Box berharga
            Rp 0 dihitung sebagai bonus, terpisah dari box berbayar.
          </p>
        </div>
        <div className="p-5">
          <DataTable rows={baris} rowKey={(r) => r.produk} columns={kolom} />
        </div>
      </div>
    </>
  );
}
