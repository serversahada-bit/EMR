import { Card, CardHead } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import {
  ALL_BRAND,
  bulanMonitoring,
  dataMonitoring,
  trenMonitoring,
  URUT_KANAL,
  URUT_PRODUK,
  type BarisMonitoring,
} from "@/data/monitoring-queries";
import { formatCount, formatIDR, formatPercent } from "@/lib/format";

import { Angka, labelBulan, Pilihan, Tabel } from "../roas/cos-ui";
import { bagi, BlokProduk, Cos, rakitBlok } from "./monitoring-ui";

export const dynamic = "force-dynamic";

const persen = (x: number | null) => (x === null ? "—" : formatPercent(x * 100, 1));

/**
 * Marketing report — ringkasan semua produk (setara blok ALL BRAND di
 * sheet, tapi dijumlah ulang dari blok per produk).
 */
export default async function MonitoringPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const { bulan: diminta } = await searchParams;
  const daftarBulan = await bulanMonitoring();
  if (daftarBulan.length === 0) {
    return (
      <>
        <PageHead title="Marketing report" subtitle="Omset, kontribusi, dan COS per kanal" />
        <Card className="p-8 text-center text-sm text-ink-2">Belum ada data di tabel data_monitoring_kanal.</Card>
      </>
    );
  }
  const bulan = diminta && daftarBulan.includes(diminta) ? diminta : daftarBulan[0];
  const [rows, tren] = await Promise.all([dataMonitoring(bulan), trenMonitoring()]);
  const produk = URUT_PRODUK.filter((p) => rows.some((r) => r.produk === p));
  const blok = produk.map((p) => rakitBlok(p, rows));

  // Blok ALL BRAND diambil apa adanya dari sheet (spend CRM & target-nya
  // tidak sama dengan jumlah blok produk). Bila suatu bulan tidak punya
  // blok itu, baru dijumlah dari blok produk.
  const gabung: BarisMonitoring[] = [];
  for (const k of URUT_KANAL) {
    const rs = rows.filter((r) => r.kanal === k && r.produk !== ALL_BRAND);
    if (!rs.length) continue;
    const s = (f: (r: BarisMonitoring) => number | null) => rs.reduce((a, r) => a + (f(r) ?? 0), 0);
    gabung.push({
      produk: "Semua produk", kanal: k, grup: rs[0].grup, agregat: k === "TOTAL" ? 1 : 0,
      alokasi: s((r) => r.alokasi), spend: s((r) => r.spend), box: s((r) => r.box),
      closing: s((r) => r.closing), omset: s((r) => r.omset),
      targetBox: k === "TOTAL" ? s((r) => r.targetBox) : null, targetCos: null, targetCosEcom: null, targetCosSoscom: null,
    });
  }
  const adaAllBrand = rows.some((r) => r.produk === ALL_BRAND);
  const semua = adaAllBrand ? rakitBlok(ALL_BRAND, rows) : rakitBlok("Semua produk", gabung);
  const tot = semua.total;
  const omsetTotal = tot?.omset ?? 0;

  return (
    <>
      <PageHead
        title="Marketing report"
        subtitle={`${adaAllBrand ? "ALL BRAND (blok sheet)" : "Semua produk"} · ${labelBulan(bulan)} · omset, kontribusi, dan COS per kanal`}
      />
      <Pilihan opsi={daftarBulan.map((b) => ({ nilai: b, label: labelBulan(b) }))} aktif={bulan} href={(b) => `/monitoring?bulan=${b}`} />

      <div className="mb-5 mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Angka label="Omset" nilai={formatIDR(omsetTotal)} catatan="neto (setelah penyesuaian sheet)" />
        <Angka label="Realisasi spend" nilai={formatIDR(tot?.spend ?? 0)} />
        <Angka
          label="COS"
          nilai={<Cos nilai={bagi(tot?.spend, omsetTotal)} batas={tot?.targetCos ?? null} />}
          catatan={tot?.targetCos ? `batas ≤ ${persen(tot.targetCos)}` : "spend ÷ omset"}
        />
        <Angka
          label="Box"
          nilai={formatCount(tot?.box ?? 0)}
          catatan={tot?.targetBox ? `target ${formatCount(tot.targetBox)} (${persen(bagi(tot.box, tot.targetBox))})` : undefined}
        />
      </div>

      <BlokProduk blok={semua} />

      <div className="mb-5">
        <Card>
          <CardHead title="Per produk" subtitle={`${labelBulan(bulan)} · kontribusi = omset produk ÷ omset semua produk`} />
          <Tabel
            kepala={["Produk", "Omset", "Kontribusi omset", "Spend", "COS", "Batas COS", "Box", "Capaian box"]}
            baris={blok.map((b) => [
              b.produk,
              formatIDR(b.total?.omset ?? b.omsetKotor),
              persen(bagi(b.total?.omset ?? b.omsetKotor, omsetTotal)),
              formatIDR(b.total?.spend ?? 0),
              <Cos key="c" nilai={bagi(b.total?.spend, b.total?.omset)} batas={b.total?.targetCos ?? null} />,
              b.total?.targetCos ? `≤ ${persen(b.total.targetCos)}` : "—",
              formatCount(b.total?.box ?? 0),
              persen(bagi(b.total?.box, b.total?.targetBox)),
            ])}
          />
        </Card>
      </div>

      <Card>
        <CardHead title="Tren bulanan" subtitle="Blok ALL BRAND di sheet" />
        <Tabel
          kepala={["Bulan", "Omset", "Spend", "COS", "Box", "Target box", "Capaian"]}
          baris={tren.map((t) => [
            labelBulan(t.bulan),
            formatIDR(t.omset),
            formatIDR(t.spend),
            persen(bagi(t.spend, t.omset)),
            formatCount(t.box),
            t.targetBox ? formatCount(t.targetBox) : "—",
            persen(bagi(t.box, t.targetBox)),
          ])}
        />
      </Card>
    </>
  );
}
