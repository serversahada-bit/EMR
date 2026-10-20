import { Card, CardHead } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { blastBulanan, bulanCrm, produkCrm, roBulanan, type BlastBulan } from "@/data/crm-queries";
import { formatCount, formatIDR, formatPercent } from "@/lib/format";

import { Angka, bagi, labelBulan, Tabel } from "../roas/cos-ui";
import { pilihDari, PilihBulanProduk } from "./crm-ui";

export const dynamic = "force-dynamic";

/**
 * CRM & blast — ringkasan bulanan.
 *
 * Box & closing CRM dari sheet CRM (repeat order per CS); biaya & hasil
 * blast dari sheet PERFORMA BLAST CRM. Spend blast yang ternyata salinan
 * (lihat crm-queries) ditampilkan tetapi tidak dijumlahkan.
 */
export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; produk?: string }>;
}) {
  const diminta = await searchParams;
  const [daftarBulan, daftarProduk, ro, blast] = await Promise.all([
    bulanCrm(),
    produkCrm(),
    roBulanan(),
    blastBulanan(),
  ]);

  if (daftarBulan.length === 0) {
    return (
      <>
        <PageHead title="CRM & blast" subtitle="Repeat order, performa CS, dan biaya blast" />
        <Card className="p-8">
          <p className="text-center text-sm font-semibold text-ink">Belum ada data CRM</p>
          <p className="mx-auto mt-2 max-w-xl text-center text-xs leading-relaxed text-ink-2">
            Tabel data_crm_ro, data_crm_cs, dan data_crm_blast masih kosong.
          </p>
        </Card>
      </>
    );
  }

  const { bulan, produk } = pilihDari(diminta, daftarBulan, daftarProduk);
  const cocok = (p: string) => !produk || p === produk;
  const jumlah = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
  const spendSah = (bs: BlastBulan[]) => jumlah(bs, (b) => (b.spendSalinan ? 0 : b.spend));

  const roIni = ro.filter((r) => r.bulan === bulan && cocok(r.produk));
  const blIni = blast.filter((b) => b.bulan === bulan && cocok(b.produk));
  const spend = spendSah(blIni);
  const omsetBlast = jumlah(blIni, (b) => b.omset);
  const tersalin = blIni.filter((b) => b.spendSalinan).length;
  const rasio = bagi(spend, omsetBlast);

  return (
    <>
      <PageHead
        title="CRM & blast"
        subtitle={`Repeat order, performa CS, dan biaya blast · ${produk ?? "Semua produk"} · ${labelBulan(bulan)}`}
      />

      <PilihBulanProduk
        path="/crm"
        bulan={bulan}
        daftarBulan={daftarBulan}
        produk={produk}
        daftarProduk={daftarProduk}
      />

      <div className="mb-5 mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Angka label="Box CRM (RO)" nilai={formatCount(jumlah(roIni, (r) => r.box))} catatan="sheet CRM, semua CS" />
        <Angka label="Closing CRM (RO)" nilai={formatCount(jumlah(roIni, (r) => r.closing))} />
        <Angka
          label="Spend blast"
          nilai={blIni.length ? formatIDR(spend) : "—"}
          catatan={tersalin ? `${tersalin} produk tidak dijumlah (salinan)` : "cost chat, ongkir, promo"}
        />
        <Angka label="Omset blast" nilai={blIni.length ? formatIDR(omsetBlast) : "—"} />
        <Angka
          label="Biaya ÷ omset blast"
          nilai={rasio === null || spend === 0 ? "—" : formatPercent(rasio * 100)}
        />
      </div>

      <div className="mb-5">
        <Card>
          <CardHead title="Per produk" subtitle={labelBulan(bulan)} />
          <Tabel
            kepala={["Produk", "Closing RO", "Box RO", "Spend blast", "Box blast", "Omset blast", "Biaya ÷ omset"]}
            baris={daftarProduk
              .filter(cocok)
              .map((p) => ({
                p,
                r: ro.filter((x) => x.bulan === bulan && x.produk === p),
                b: blast.find((x) => x.bulan === bulan && x.produk === p),
              }))
              .filter(({ r, b }) => r.length > 0 || b)
              .map(({ p, r, b }) => [
                p,
                formatCount(jumlah(r, (x) => x.closing)),
                formatCount(jumlah(r, (x) => x.box)),
                !b ? (
                  "—"
                ) : b.spendSalinan ? (
                  <span key="s" className="text-muted" title={b.spendSalinan}>
                    {formatIDR(b.spend)} *
                  </span>
                ) : (
                  formatIDR(b.spend)
                ),
                b ? formatCount(b.box) : "—",
                b ? formatIDR(b.omset) : "—",
                b && !b.spendSalinan && b.omset > 0 ? formatPercent((b.spend / b.omset) * 100) : "—",
              ])}
          />
        </Card>
      </div>

      <Card>
        <CardHead title="Tren bulanan" subtitle={produk ?? "Semua produk"} />
        <Tabel
          kepala={["Bulan", "Closing RO", "Box RO", "Spend blast", "Omset blast", "Biaya ÷ omset"]}
          baris={[...daftarBulan].reverse().map((b) => {
            const r = ro.filter((x) => x.bulan === b && cocok(x.produk));
            const bl = blast.filter((x) => x.bulan === b && cocok(x.produk));
            const sp = spendSah(bl);
            const om = jumlah(bl, (x) => x.omset);
            return [
              labelBulan(b),
              formatCount(jumlah(r, (x) => x.closing)),
              formatCount(jumlah(r, (x) => x.box)),
              bl.length ? formatIDR(sp) : "—",
              bl.length ? formatIDR(om) : "—",
              om > 0 && sp > 0 ? formatPercent((sp / om) * 100) : "—",
            ];
          })}
        />
      </Card>

      <div className="mt-4 space-y-1.5 text-xs leading-relaxed text-ink-2">
        <p>
          * Spend blast bertanda bintang tidak ikut dijumlah: angkanya sama
          persis dengan spend Gamamilk di bulan yang sama atau dengan bulan
          sebelumnya — sheet PERFORMA BLAST CRM di file itu kemungkinan
          salinan yang belum diperbarui. Box dan omsetnya tetap dihitung.
        </p>
        <p>
          Box CRM diambil dari sheet CRM. Untuk September 2026 angkanya
          lebih rendah dari Box CRM di sheet COST OF SALES; Juli–Agustus
          selisihnya hanya 1–2%.
        </p>
      </div>
    </>
  );
}
