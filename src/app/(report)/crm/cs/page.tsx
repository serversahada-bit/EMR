import Link from "next/link";

import { Card, CardHead } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { bulanCrm, csRingkas, produkCrm, type CsRingkas } from "@/data/crm-queries";
import { formatCount, formatPercent } from "@/lib/format";

import { bagi, labelBulan, Pilihan, Tabel } from "../../roas/cos-ui";
import { pilihDari, PilihBulanProduk, SEMUA, urlCrm } from "../crm-ui";

export const dynamic = "force-dynamic";

const JENIS = [
  { nilai: "AKUISISI", label: "CS akuisisi (lead iklan)" },
  { nilai: "CRM", label: "CS CRM" },
];

/**
 * Performa CS dari sheet "CS <nama>" / "CSO". Tanpa ?cs= : satu baris per
 * CS. Dengan ?cs= : rincian CS itu per sumber (sumber iklan untuk CS
 * akuisisi; New Customer <ADV> / Reseller / RO untuk CS CRM).
 */
export default async function CsPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; produk?: string; jenis?: string; cs?: string }>;
}) {
  const diminta = await searchParams;
  const jenis = JENIS.some((j) => j.nilai === diminta.jenis) ? diminta.jenis! : "AKUISISI";
  const [daftarBulan, daftarProduk] = await Promise.all([bulanCrm(), produkCrm()]);
  const { bulan, produk } = pilihDari(diminta, daftarBulan, daftarProduk);
  const cs = diminta.cs?.trim() || null;
  const baris = bulan ? await csRingkas(bulan, jenis, produk, cs) : [];
  const akuisisi = jenis === "AKUISISI";

  const lead = (r: CsRingkas) => r.leadForm + r.leadWa + r.leadLain;
  const t = baris.reduce(
    (a, r) => ({ ...a, leadForm: a.leadForm + r.leadForm, leadWa: a.leadWa + r.leadWa, leadLain: a.leadLain + r.leadLain,
      closing: a.closing + r.closing, box: a.box + r.box, closingFu: a.closingFu + r.closingFu, boxFu: a.boxFu + r.boxFu }),
    { nama: "Jumlah", leadForm: 0, leadWa: 0, leadLain: 0, closing: 0, box: 0, closingFu: 0, boxFu: 0 } as CsRingkas,
  );
  const sel = (r: CsRingkas, judul: React.ReactNode) => [
    judul,
    ...(akuisisi
      ? [formatCount(r.leadForm), formatCount(r.leadWa + r.leadLain), formatCount(lead(r))]
      : []),
    formatCount(r.closing),
    formatCount(r.box),
    ...(akuisisi
      ? [(() => { const x = bagi(r.closing, lead(r)); return x === null ? "—" : formatPercent(x * 100); })(),
         formatCount(r.closingFu), formatCount(r.boxFu)]
      : []),
    (() => { const x = bagi(r.box, r.closing); return x === null ? "—" : x.toFixed(2).replace(".", ","); })(),
  ];
  const lain = { jenis, cs };

  return (
    <>
      <PageHead
        title="Performa CS"
        subtitle={`${cs ? `CS ${cs} per sumber` : "Per CS"} · ${JENIS.find((j) => j.nilai === jenis)!.label} · ${produk ?? "Semua produk"} · ${bulan ? labelBulan(bulan) : "—"}`}
      />
      <Pilihan
        opsi={JENIS}
        aktif={jenis}
        href={(j) => urlCrm("/crm/cs", { bulan, produk: produk ?? SEMUA, jenis: j })}
      />
      <PilihBulanProduk path="/crm/cs" bulan={bulan} daftarBulan={daftarBulan} produk={produk} daftarProduk={daftarProduk} lain={lain} />

      {cs ? (
        <p className="mb-3 mt-1 text-xs">
          <Link className="text-ink-2 underline" href={urlCrm("/crm/cs", { bulan, produk: produk ?? SEMUA, jenis })}>
            ← kembali ke semua CS
          </Link>
        </p>
      ) : null}

      <Card className="mt-2">
        <CardHead
          title={cs ? `Sumber — CS ${cs}` : "Per CS"}
          subtitle={
            akuisisi
              ? "Lead dari iklan → closing pelanggan baru · Upselling = box ÷ closing"
              : "Closing & box per sumber (New Customer ADV, Reseller, RO) · Upselling = box ÷ closing"
          }
        />
        <Tabel
          kepala={[
            cs ? "Sumber" : "CS",
            ...(akuisisi ? ["Lead form", "Lead WA", "Total lead"] : []),
            "Closing",
            "Box",
            ...(akuisisi ? ["Closing rate", "Closing FU", "Box FU"] : []),
            "Upselling",
          ]}
          baris={baris.map((r) =>
            sel(
              r,
              cs ? (
                r.nama
              ) : (
                <Link key="l" className="underline" href={urlCrm("/crm/cs", { bulan, produk: produk ?? SEMUA, jenis, cs: r.nama })}>
                  {r.nama}
                </Link>
              ),
            ),
          )}
          kaki={sel(t, "Jumlah")}
        />
      </Card>
      <p className="mt-4 text-xs leading-relaxed text-ink-2">
        Dari sheet CS per orang di file Progres. Sheet yang kosong atau sama
        persis dengan bulan sebelumnya (beku) tidak dimuat — lihat sheet LOG
        di ALL CRM 2026.xlsx.
      </p>
    </>
  );
}
