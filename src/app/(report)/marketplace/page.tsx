import Link from "next/link";

import { Card, CardHead } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import {
  agregatDisaring,
  harianMp,
  produkMp,
  ringkasBulanMp,
  sumberMp,
} from "@/data/mp-queries";
import { formatCount, formatIDR } from "@/lib/format";

export const dynamic = "force-dynamic";

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function labelBulan(b: string): string {
  const [th, bl] = b.split("-");
  return `${NAMA_BULAN[Number(bl) - 1] ?? bl} ${th}`;
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const { bulan: diminta } = await searchParams;

  const sumber = await sumberMp();
  if (sumber.length === 0) {
    return (
      <>
        <PageHead title="Marketplace" subtitle="Shopee, Lazada, dan TikTok Shop" />
        <Card className="p-8">
          <p className="text-center text-sm font-semibold text-ink">
            Belum ada tabel marketplace
          </p>
          <p className="mx-auto mt-2 max-w-xl text-center text-xs leading-relaxed text-ink-2">
            Database belum memuat tabel bernama data_spend_mp… — halaman ini
            terisi sendiri begitu tabelnya dibuat, tanpa mengubah kode.
          </p>
        </Card>
      </>
    );
  }

  const bulanan = await ringkasBulanMp();
  const pilihan = [...bulanan.map((b) => b.bulan)].reverse();
  const bulan = diminta && pilihan.includes(diminta) ? diminta : (pilihan[0] ?? "");

  const [harian, perProduk, disaring] = await Promise.all([
    harianMp(bulan),
    produkMp(bulan),
    agregatDisaring(bulan),
  ]);

  const ini = bulanan.find((b) => b.bulan === bulan);
  const spend = Number(ini?.spend ?? 0);
  const omset = Number(ini?.omset ?? 0);
  const rasio = spend > 0 ? omset / spend : null;

  /* Dipisah per kanal supaya Shopee/Lazada tidak tercampur TikTok. */
  const perKanal = new Map<string, { spend: number; omset: number; box: number }>();
  for (const r of harian) {
    const a = perKanal.get(r.kanal) ?? { spend: 0, omset: 0, box: 0 };
    a.spend += Number(r.spend);
    a.omset += Number(r.omset);
    a.box += Number(r.box);
    perKanal.set(r.kanal, a);
  }

  return (
    <>
      <PageHead
        title="Marketplace"
        subtitle={`Shopee, Lazada, dan TikTok Shop · ${sumber.length} tabel · ${labelBulan(bulan)}`}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {pilihan.map((b) => (
          <Link
            key={b}
            href={`/marketplace?bulan=${b}`}
            className={
              "rounded-xl border px-3.5 py-2 text-xs " +
              (b === bulan
                ? "border-transparent bg-ink text-surface"
                : "border-hairline bg-surface text-ink-2 hover:text-ink")
            }
          >
            {labelBulan(b)}
          </Link>
        ))}
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Angka label="Omset" nilai={formatIDR(omset)} />
        <Angka label="Spend" nilai={formatIDR(spend)} />
        <Angka
          label="Omset / Spend"
          nilai={rasio === null ? "—" : `${rasio.toFixed(2)}×`}
        />
        <Angka label="Box" nilai={formatCount(Number(ini?.box ?? 0))} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHead title="Per kanal" subtitle={labelBulan(bulan)} />
          <Tabel
            kepala={["Kanal", "Spend", "Omset", "Box"]}
            baris={[...perKanal.entries()].map(([k, v]) => [
              k,
              formatIDR(v.spend),
              formatIDR(v.omset),
              formatCount(v.box),
            ])}
          />
        </Card>

        <Card>
          <CardHead title="Per produk" subtitle={labelBulan(bulan)} />
          <Tabel
            kepala={["Produk", "Spend", "Omset", "Box"]}
            baris={perProduk.map((p) => [
              p.produk,
              formatIDR(Number(p.spend)),
              formatIDR(Number(p.omset)),
              formatCount(Number(p.box)),
            ])}
          />
        </Card>
      </div>

      <Card>
        <CardHead
          title="Tren bulanan"
          subtitle="Seluruh produk, blok agregat tidak diikutkan"
        />
        <Tabel
          kepala={["Bulan", "Spend", "Omset", "Omset/Spend", "Box", "Pesanan"]}
          baris={bulanan.map((b) => [
            labelBulan(b.bulan),
            formatIDR(Number(b.spend)),
            formatIDR(Number(b.omset)),
            Number(b.spend) > 0
              ? `${(Number(b.omset) / Number(b.spend)).toFixed(2)}×`
              : "—",
            formatCount(Number(b.box)),
            formatCount(Number(b.pesanan)),
          ])}
        />
      </Card>

      {/* Selisih dengan Excel pasti ditanyakan, jadi diterangkan di
          halaman — bukan dibiarkan jadi misteri. */}
      <p className="mt-4 text-xs leading-relaxed text-ink-2">
        Angka di atas hanya memakai blok <strong>per-toko</strong>. Blok
        berlabel TOTAL di Excel tetap tersimpan di database tetapi tidak
        dijumlahkan di sini, karena isinya mengulang toko yang sama
        {disaring.baris > 0 ? (
          <>
            {" "}— pada {labelBulan(bulan)} ada {formatCount(Number(disaring.baris))}{" "}
            baris agregat senilai {formatIDR(Number(disaring.spend))} spend dan{" "}
            {formatIDR(Number(disaring.omset))} omset yang disaring
          </>
        ) : null}
        .
      </p>
    </>
  );
}

function Angka({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-ink">{nilai}</p>
    </div>
  );
}

function Tabel({
  kepala,
  baris,
}: {
  kepala: string[];
  baris: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto px-5 pb-5">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-hairline text-left text-muted">
            {kepala.map((h, i) => (
              <th
                key={h}
                className={"py-2 font-medium " + (i === 0 ? "" : "text-right")}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.length === 0 ? (
            <tr>
              <td colSpan={kepala.length} className="py-6 text-center text-ink-2">
                Tidak ada baris pada bulan ini.
              </td>
            </tr>
          ) : (
            baris.map((r, i) => (
              <tr key={i} className="border-b border-hairline/60 last:border-0">
                {r.map((c, j) => (
                  <td
                    key={j}
                    className={
                      "py-2 " +
                      (j === 0 ? "text-ink" : "text-right tabular-nums text-ink-2")
                    }
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
