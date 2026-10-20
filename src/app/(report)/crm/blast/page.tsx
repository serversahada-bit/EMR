import { Card, CardHead } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { blastBulanan, blastHarian, bulanCrm, produkCrm } from "@/data/crm-queries";
import { formatCount, formatIDRPenuh, formatPercent } from "@/lib/format";

import { bagi, labelBulan, Tabel } from "../../roas/cos-ui";
import { pilihDari, PilihBulanProduk } from "../crm-ui";

export const dynamic = "force-dynamic";

const persen = (r: number | null) => (r === null ? "—" : formatPercent(r * 100));

/** Tabel harian sheet PERFORMA BLAST CRM. Default produk Gamamilk. */
export default async function BlastPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; produk?: string }>;
}) {
  const diminta = await searchParams;
  const [semuaBulan, daftarProduk, bulanan] = await Promise.all([bulanCrm(), produkCrm(), blastBulanan()]);
  const adaBlast = new Set(bulanan.map((b) => b.bulan));
  const daftarBulan = semuaBulan.filter((b) => adaBlast.has(b));
  const produkBlast = daftarProduk.filter((p) => bulanan.some((b) => b.produk === p));
  const { bulan, produk } = pilihDari(diminta, daftarBulan, produkBlast, "Gamamilk");

  const harian = bulan ? await blastHarian(bulan, produk) : [];
  const salinan = bulanan.filter((b) => b.bulan === bulan && (!produk || b.produk === produk) && b.spendSalinan);
  const t = harian.reduce(
    (a, h) => ({
      costChat: a.costChat + h.costChat, ongkir: a.ongkir + h.ongkir, promoHadiah: a.promoHadiah + h.promoHadiah,
      promoCb: a.promoCb + h.promoCb, freeProduk: a.freeProduk + h.freeProduk, spend: a.spend + h.spend,
      data: a.data + h.data, closing: a.closing + h.closing, box: a.box + h.box, omset: a.omset + h.omset,
    }),
    { costChat: 0, ongkir: 0, promoHadiah: 0, promoCb: 0, freeProduk: 0, spend: 0, data: 0, closing: 0, box: 0, omset: 0 },
  );

  return (
    <>
      <PageHead
        title="Blast CRM"
        subtitle={`Sheet PERFORMA BLAST CRM · ${produk ?? "Semua produk"} · ${bulan ? labelBulan(bulan) : "—"} · ${harian.length} hari`}
      />
      <PilihBulanProduk path="/crm/blast" bulan={bulan} daftarBulan={daftarBulan} produk={produk} daftarProduk={produkBlast} />

      {salinan.length ? (
        <p
          className="mb-4 mt-2 rounded-xl px-4 py-3 text-xs font-medium"
          style={{ background: "var(--warning-bg)", color: "var(--warning-fg)" }}
        >
          Spend blast {salinan.map((s) => `${s.produk} (${s.spendSalinan})`).join(", ")} — kemungkinan salinan
          yang belum diperbarui. Kolom biaya di bawah apa adanya dari sheet; di halaman ringkasan tidak ikut dijumlah.
        </p>
      ) : null}

      <Card className="mt-2">
        <CardHead title="Biaya & hasil blast per hari" subtitle="CR = closing ÷ data · Biaya ÷ omset = total spend ÷ omset" />
        <Tabel
          kepala={["Tanggal", "Cost chat", "Ongkir", "Promo hadiah", "Promo CB", "Free produk", "Total spend", "Data", "Closing", "CR", "Box", "Omset", "Biaya ÷ omset"]}
          baris={harian.map((h) => [
            h.tanggal.slice(8, 10) + "/" + h.tanggal.slice(5, 7),
            formatIDRPenuh(h.costChat), formatIDRPenuh(h.ongkir), formatIDRPenuh(h.promoHadiah),
            formatIDRPenuh(h.promoCb), formatIDRPenuh(h.freeProduk), formatIDRPenuh(h.spend),
            formatCount(h.data), formatCount(h.closing), persen(bagi(h.closing, h.data)),
            formatCount(h.box), formatIDRPenuh(h.omset), persen(bagi(h.spend, h.omset)),
          ])}
          kaki={[
            "Jumlah", formatIDRPenuh(t.costChat), formatIDRPenuh(t.ongkir), formatIDRPenuh(t.promoHadiah),
            formatIDRPenuh(t.promoCb), formatIDRPenuh(t.freeProduk), formatIDRPenuh(t.spend),
            formatCount(t.data), formatCount(t.closing), persen(bagi(t.closing, t.data)),
            formatCount(t.box), formatIDRPenuh(t.omset), persen(bagi(t.spend, t.omset)),
          ]}
        />
      </Card>
    </>
  );
}
