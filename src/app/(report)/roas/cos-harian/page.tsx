import { Card, CardHead } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { cosBulanan, cosHarian, type CosHari } from "@/data/cos-queries";
import { formatCount, formatIDRPenuh, formatMultiple } from "@/lib/format";

import { bagi, hariTerisi, labelBulan, NilaiCos, Pilihan, Tabel } from "../cos-ui";

export const dynamic = "force-dynamic";

/**
 * Tabel COS harian — satu baris per tanggal, seperti di sheet
 * "COST OF SALES". Rupiah ditulis penuh supaya bisa dicocokkan sel per
 * sel dengan Excel.
 */
export default async function CosHarianPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; produk?: string }>;
}) {
  const { bulan: dimintaBulan, produk: dimintaProduk } = await searchParams;

  const bulanan = await cosBulanan();
  if (bulanan.length === 0) {
    return (
      <>
        <PageHead title="Tabel COS harian" subtitle="Cost of Sales per hari" />
        <Card className="p-8">
          <p className="text-center text-sm font-semibold text-ink">
            Belum ada tabel COS
          </p>
        </Card>
      </>
    );
  }

  const daftarBulan = [...new Set(bulanan.map((r) => r.bulan))].sort().reverse();
  const daftarProduk = [...new Set(bulanan.map((r) => r.produk))];
  const bulan =
    dimintaBulan && daftarBulan.includes(dimintaBulan) ? dimintaBulan : daftarBulan[0];
  const produk =
    dimintaProduk && daftarProduk.includes(dimintaProduk) ? dimintaProduk : null;

  const harian = await cosHarian(bulan, produk);
  const total = harian.reduce<Omit<CosHari, "tanggal">>(
    (a, h) => {
      const r = { ...a };
      for (const k of Object.keys(a) as (keyof typeof a)[]) r[k] += h[k];
      return r;
    },
    {
      konversi: 0, mbc: 0, salesPromotion: 0, lainLain: 0, spend: 0,
      omsetAkuisisi: 0, omsetCrm: 0, omsetMp: 0, omsetTiktok: 0, omset: 0, box: 0,
    },
  );
  const koreksi = bulanan
    .filter((r) => r.bulan === bulan && (!produk || r.produk === produk))
    .reduce((a, r) => a + r.koreksi, 0);

  const qs = (b: string, p: string | null) =>
    `/roas/cos-harian?bulan=${b}${p ? `&produk=${encodeURIComponent(p)}` : ""}`;
  const tgl = (s: string) => {
    const [, m, d] = s.split("-");
    return `${d}/${m}`;
  };
  const rp = (n: number) => (n ? formatIDRPenuh(n) : "—");

  return (
    <>
      <PageHead
        title="Tabel COS harian"
        subtitle={`${produk ?? "Semua produk Gamamilk"} · ${labelBulan(bulan)} · ${hariTerisi(harian)} hari terisi`}
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

      <Card className="mt-2">
        <CardHead
          title="Spend & omset per hari"
          subtitle="Dari sheet COST OF SALES · COS = total spend ÷ total omset"
        />
        <Tabel
          kepala={[
            "Tanggal", "Konversi", "MBC", "Sales promo", "Lain-lain", "Total spend",
            "Omset akuisisi", "Omset CRM", "Omset MP", "Omset TikTok", "Total omset",
            "Box", "COS", "ROAS",
          ]}
          baris={harian.map((h) => [
            tgl(h.tanggal),
            rp(h.konversi),
            rp(h.mbc),
            rp(h.salesPromotion),
            rp(h.lainLain),
            rp(h.spend),
            rp(h.omsetAkuisisi),
            rp(h.omsetCrm),
            rp(h.omsetMp),
            rp(h.omsetTiktok),
            rp(h.omset),
            formatCount(h.box),
            <NilaiCos key="c" cos={bagi(h.spend, h.omset)} />,
            h.spend > 0 ? formatMultiple(h.omset / h.spend) : "—",
          ])}
          kaki={[
            "Jumlah",
            rp(total.konversi),
            rp(total.mbc),
            rp(total.salesPromotion),
            rp(total.lainLain),
            rp(total.spend),
            rp(total.omsetAkuisisi),
            rp(total.omsetCrm),
            rp(total.omsetMp),
            rp(total.omsetTiktok),
            rp(total.omset),
            formatCount(total.box),
            <NilaiCos key="c" cos={bagi(total.spend, total.omset)} />,
            total.spend > 0 ? formatMultiple(total.omset / total.spend) : "—",
          ]}
        />
      </Card>

      <div className="mt-4 space-y-1.5 text-xs leading-relaxed text-ink-2">
        {koreksi ? (
          <p>
            Baris TOTAL sheet bulan ini dikoreksi{" "}
            <strong>{formatIDRPenuh(koreksi)}</strong> (Kompensasi Snack + Pajak
            atau potongan di rumus). Koreksi itu tidak ada di baris harian,
            jadi jumlah di atas belum dikurangi. Angka sesudah koreksi ada di
            halaman ROAS &amp; efisiensi.
          </p>
        ) : null}
        <p>
          Tanggal mengikuti bulan di nama file Progres. Kolom tanggal di sheet
          sering masih berisi tanggal bulan lalu, dan baris ke-31 pada bulan 30
          hari tidak ikut ditampilkan.
        </p>
      </div>
    </>
  );
}
