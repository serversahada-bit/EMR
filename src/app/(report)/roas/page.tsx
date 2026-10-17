import { Card, CardHead } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { cosBulanan, cosHarian, TARGET_COS, type CosBulan } from "@/data/cos-queries";
import { formatIDR, formatMultiple, formatPercent } from "@/lib/format";

import { Angka, bagi, hariTerisi, labelBulan, NilaiCos, Pilihan, Tabel } from "./cos-ui";

export const dynamic = "force-dynamic";

/**
 * ROAS & efisiensi — sumbernya sheet "COST OF SALES".
 *
 * Sheet COS menjawab masalah atribusi yang dulu menahan halaman ini:
 * omsetnya dijumlah lintas kanal (Akuisisi + CRM + MP + TikTok), jadi
 * closing dari iklan yang tercatat di CRM atau Shopee ikut terhitung.
 *
 * Angka utama memakai versi SHEET (baris TOTAL, sesudah koreksi
 * Kompensasi Snack + Pajak) karena itulah yang dilihat pemilik sheet.
 * Jumlah harian tetap ditampilkan di sebelahnya supaya selisihnya
 * kelihatan dan bisa dijelaskan.
 */
export default async function RoasPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; produk?: string }>;
}) {
  const { bulan: dimintaBulan, produk: dimintaProduk } = await searchParams;

  const semua = await cosBulanan();
  if (semua.length === 0) {
    return (
      <>
        <PageHead title="ROAS & efisiensi" subtitle="Cost of Sales (COS)" />
        <Card className="p-8">
          <p className="text-center text-sm font-semibold text-ink">
            Belum ada tabel COS
          </p>
          <p className="mx-auto mt-2 max-w-xl text-center text-xs leading-relaxed text-ink-2">
            Database belum memuat tabel bernama data_cos_&lt;tahun&gt;_bulanan —
            halaman ini terisi sendiri begitu tabelnya dibuat, tanpa mengubah kode.
          </p>
        </Card>
      </>
    );
  }

  const daftarBulan = [...new Set(semua.map((r) => r.bulan))].sort().reverse();
  const daftarProduk = [...new Set(semua.map((r) => r.produk))];
  const bulan =
    dimintaBulan && daftarBulan.includes(dimintaBulan) ? dimintaBulan : daftarBulan[0];
  const produk =
    dimintaProduk && daftarProduk.includes(dimintaProduk) ? dimintaProduk : null;

  const terpilih = semua.filter((r) => !produk || r.produk === produk);
  const jumlah = (rs: CosBulan[]) =>
    rs.reduce(
      (a, r) => ({
        koreksi: a.koreksi + r.koreksi,
        spend: a.spend + r.spendSheet,
        omset: a.omset + r.omsetSheet,
      }),
      { koreksi: 0, spend: 0, omset: 0 },
    );
  const t = jumlah(terpilih.filter((r) => r.bulan === bulan));
  const cos = bagi(t.spend, t.omset);

  /* Hari yang benar-benar terisi — bulan berjalan baru sebagian. */
  const harian = await cosHarian(bulan, produk);
  const terisi = hariTerisi(harian);

  const perBulan = daftarBulan
    .slice()
    .reverse()
    .map((b) => ({ bulan: b, ...jumlah(terpilih.filter((r) => r.bulan === b)) }));

  const qs = (b: string, p: string | null) =>
    `/roas?bulan=${b}${p ? `&produk=${encodeURIComponent(p)}` : ""}`;

  return (
    <>
      <PageHead
        title="ROAS & efisiensi"
        subtitle={`Cost of Sales (COS) · ${produk ?? "Semua produk Gamamilk"} · ${labelBulan(bulan)} · ${terisi} hari terisi`}
      />

      <Pilihan
        opsi={daftarBulan.map((b) => ({ nilai: b, label: labelBulan(b) }))}
        aktif={bulan}
        href={(b) => qs(b, produk)}
      />
      <Pilihan
        opsi={[
          { nilai: "", label: "Semua produk" },
          ...daftarProduk.map((p) => ({ nilai: p, label: p })),
        ]}
        aktif={produk ?? ""}
        href={(p) => qs(bulan, p || null)}
      />

      <div className="mb-5 mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Angka
          label="COS"
          nilai={<NilaiCos cos={cos} />}
          catatan={`Target ≤ ${formatPercent(TARGET_COS * 100, 0)}`}
        />
        <Angka
          label="Spend"
          nilai={formatIDR(t.spend)}
          catatan={t.koreksi ? `sudah termasuk koreksi ${formatIDR(t.koreksi)}` : undefined}
        />
        <Angka
          label="Omset"
          nilai={formatIDR(t.omset)}
          catatan="Akuisisi + CRM + MP + TikTok"
        />
        <Angka
          label="ROAS (omset ÷ spend)"
          nilai={t.spend > 0 ? formatMultiple(t.omset / t.spend) : "—"}
        />
      </div>

      <div className="mb-5">
        <Card>
          <CardHead
            title="Per produk"
            subtitle={`${labelBulan(bulan)} · spend & omset = baris TOTAL sheet`}
          />
          <Tabel
            kepala={["Produk", "Spend harian", "Koreksi", "Spend", "Omset", "COS", "ROAS"]}
            baris={semua
              .filter((r) => r.bulan === bulan)
              .map((r) => [
                r.produk,
                formatIDR(r.spendHarian),
                r.koreksi ? formatIDR(r.koreksi) : "—",
                formatIDR(r.spendSheet),
                formatIDR(r.omsetSheet),
                <NilaiCos key="c" cos={bagi(r.spendSheet, r.omsetSheet)} />,
                r.spendSheet > 0 ? formatMultiple(r.omsetSheet / r.spendSheet) : "—",
              ])}
          />
        </Card>
      </div>

      <Card>
        <CardHead title="Tren bulanan" subtitle={produk ?? "Semua produk Gamamilk"} />
        <Tabel
          kepala={["Bulan", "Spend", "Omset", "COS", "ROAS"]}
          baris={perBulan.map((b) => [
            labelBulan(b.bulan),
            formatIDR(b.spend),
            formatIDR(b.omset),
            <NilaiCos key="c" cos={bagi(b.spend, b.omset)} />,
            b.spend > 0 ? formatMultiple(b.omset / b.spend) : "—",
          ])}
        />
      </Card>

      {/* Selisih dengan Excel pasti ditanyakan, jadi diterangkan di halaman. */}
      <div className="mt-4 space-y-1.5 text-xs leading-relaxed text-ink-2">
        <p>
          COS = spend ÷ omset dari sheet <strong>COST OF SALES</strong>. Angka
          memakai baris TOTAL sheet, yang sudah dikurangi koreksi pemilik
          sheet (Kompensasi Snack + Pajak dan potongan yang diketik langsung
          di rumus). Koreksi itu tidak ada di baris harian, jadi jumlah di{" "}
          <em>Tabel COS harian</em> bisa sedikit lebih besar.
        </p>
        <p>
          Omset di sheet ini dihitung dari box × harga tetap per kanal, bukan
          omset riil, jadi tidak akan sama persis dengan halaman Marketplace
          atau Omset.
        </p>
        <p className="text-muted">
          Belum tersedia: ROAS per kanal iklan (Meta vs Google) dan per ADV.
        </p>
      </div>
    </>
  );
}
