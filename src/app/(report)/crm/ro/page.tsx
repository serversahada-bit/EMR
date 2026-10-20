import { Card, CardHead } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { bulanCrm, produkCrm, roPerCs } from "@/data/crm-queries";
import { formatCount } from "@/lib/format";

import { bagi, labelBulan, Tabel } from "../../roas/cos-ui";
import { pilihDari, PilihBulanProduk } from "../crm-ui";

export const dynamic = "force-dynamic";

const SEGMEN = ["RO 1", "RO 2", "RESELLER"];

const up = (box: number, closing: number) => {
  const x = bagi(box, closing);
  return x === null ? "—" : x.toFixed(2).replace(".", ",");
};

/** Repeat order per CS dari sheet CRM: closing (alamat) & box per segmen. */
export default async function RoPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; produk?: string }>;
}) {
  const diminta = await searchParams;
  const [daftarBulan, daftarProduk] = await Promise.all([bulanCrm(), produkCrm()]);
  const { bulan, produk } = pilihDari(diminta, daftarBulan, daftarProduk);
  const rows = bulan ? await roPerCs(bulan, produk) : [];

  const daftarCs = [...new Set(rows.map((r) => r.cs))];
  const ambil = (cs: string | null, seg: string) =>
    rows
      .filter((r) => (cs === null || r.cs === cs) && r.segmen === seg)
      .reduce((a, r) => ({ closing: a.closing + r.closing, box: a.box + r.box }), { closing: 0, box: 0 });
  const sel = (cs: string | null) => {
    const per = SEGMEN.map((s) => ambil(cs, s));
    const tot = per.reduce((a, x) => ({ closing: a.closing + x.closing, box: a.box + x.box }), { closing: 0, box: 0 });
    return [
      cs ?? "Jumlah",
      ...per.flatMap((x) => [formatCount(x.closing), formatCount(x.box)]),
      formatCount(tot.closing),
      formatCount(tot.box),
      up(tot.box, tot.closing),
    ];
  };

  return (
    <>
      <PageHead
        title="Repeat order (RO)"
        subtitle={`Sheet CRM · ${produk ?? "Semua produk"} · ${bulan ? labelBulan(bulan) : "—"}`}
      />
      <PilihBulanProduk path="/crm/ro" bulan={bulan} daftarBulan={daftarBulan} produk={produk} daftarProduk={daftarProduk} />
      <Card className="mt-2">
        <CardHead
          title="Per CS & segmen"
          subtitle="Closing = jumlah order (kolom ALAMAT di sheet) · Upselling = box ÷ closing"
        />
        <Tabel
          kepala={[
            "CS",
            "RO 1 closing", "RO 1 box",
            "RO 2 closing", "RO 2 box",
            "Reseller closing", "Reseller box",
            "Total closing", "Total box", "Upselling",
          ]}
          baris={daftarCs.map((cs) => sel(cs))}
          kaki={sel(null)}
        />
      </Card>
    </>
  );
}
