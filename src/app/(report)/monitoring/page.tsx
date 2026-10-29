import Link from "next/link";

import { Card } from "@/components/Card";
import { MuatUlangOtomatis } from "@/components/MuatUlangOtomatis";
import { PageHead } from "@/components/PageHead";
import { ALL_BRAND, URUT_PRODUK } from "@/data/monitoring-queries";
import { monitoringLive, type MonitoringLive } from "@/data/monitoring-sheet";

import { formatPercent } from "@/lib/format";

import { labelBulan, Pilihan } from "../roas/cos-ui";
import { BarCos, BarKontribusi, GarisCos, KolomOmset, StatusCos } from "./ceo-charts";
import { bagi, barisCosKelompok, BlokProduk, Judul, judulKanal, rakitBlok } from "./monitoring-ui";

export const dynamic = "force-dynamic";

const SEGAR_DETIK = 60;

/**
 * Marketing report = LIVE DARI SHEET (permintaan pengguna 26 Okt 2026:
 * halaman ini menggantikan versi CEO lama yang mencampur omset transaksi).
 *
 * Wujud sama dengan "Per kanal", tetapi SEMUA angka
 * (termasuk omset) diambil apa adanya dari sheet Marketing Report saat
 * dibuka, tanpa impor dan tanpa dicampur data transaksi. Gunanya:
 * melihat persis angka yang sedang dilihat tim di Google Sheets.
 *
 * Bedanya dengan /monitoring/kanal: di sana omset, box, dan closing dari
 * data_transaksi (sama dengan dashboard); di sini omset sheet, yaitu
 * omset neto rekap tim (Meta & CRM = box × harga tetap per bulan).
 */
export default async function MonitoringPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; produk?: string }>;
}) {
  const diminta = await searchParams;
  const tahun = new Date().getFullYear();

  let live: MonitoringLive | null = null;
  let galat: string | null = null;
  try {
    live = await monitoringLive(tahun);
    if (!live) galat = `Sheet Marketing Report ${tahun} belum terdaftar di aplikasi (SHEET_PER_TAHUN di monitoring-sheet.ts).`;
  } catch (e) {
    galat = e instanceof Error ? e.message : "Penyebab tidak diketahui.";
  }

  const daftarBulan = live ? [...live.perBulan.keys()].sort((a, b) => b.localeCompare(a)) : [];
  if (!live || daftarBulan.length === 0) {
    return (
      <>
        <PageHead title="Marketing report" subtitle="Live dari sheet · angka apa adanya dari Google Sheets" />
        <Card className="p-6">
          <p className="text-sm font-semibold text-ink">Sheet Marketing Report tidak bisa dibaca</p>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-ink-2">
            {galat ?? "Tidak ada tab GENERAL MONITORING yang terbaca utuh."}
          </p>
        </Card>
      </>
    );
  }

  const bulan = diminta.bulan && daftarBulan.includes(diminta.bulan) ? diminta.bulan : daftarBulan[0];
  const rows = live.perBulan.get(bulan) ?? [];
  // ALL BRAND paling depan, lalu produk — sama dengan halaman Per kanal
  const ada = [ALL_BRAND, ...URUT_PRODUK].filter((p) => rows.some((r) => r.produk === p));
  const produk = diminta.produk && ada.includes(diminta.produk) ? diminta.produk : null;
  const tampil = produk ? [produk] : ada;
  const url = (b: string, p: string | null) =>
    `/monitoring?bulan=${b}${p ? `&produk=${encodeURIComponent(p)}` : ""}`;

  /* ── Grafik — semua dari sheet, sama dengan rumus halaman Marketing
     report. Fokus = produk yang dipilih; "Semua produk" memakai blok
     ALL BRAND (angka gabungan sheet sendiri, bukan jumlah blok produk). */
  const fokus = produk ?? ALL_BRAND;
  const blok = rakitBlok(fokus, rows);
  const tot = blok.total;
  const persen = (x: number | null) => (x === null ? "—" : formatPercent(x * 100, 1));
  const pendek = (b: string) => labelBulan(b).slice(0, 3);

  // ① kontribusi omset per kanal (porsi dari jumlah omset kanal = 100%)
  const kanalOmset = blok.kanal.filter((k) => (k.omset ?? 0) > 0 && k.grup !== "LAIN");
  const jumlahKanal = kanalOmset.reduce((a, k) => a + (k.omset ?? 0), 0);
  const kontribusi = [...kanalOmset]
    .sort((a, b) => (b.omset ?? 0) - (a.omset ?? 0))
    .map((k) => ({ id: k.kanal, label: judulKanal(k.kanal), omset: k.omset ?? 0, persen: (k.omset ?? 0) / (jumlahKanal || 1) }));

  // ② COS per kelompok (SOSCOM, E-commerce) vs batas sheet, kanal anggota tanpa batas
  const cosKanal = barisCosKelompok(blok);

  // ③ tren tiap bulan yang ada di sheet — baris TOTAL produk fokus
  const tren = [...daftarBulan].reverse().map((b) => {
    const t = live.perBulan.get(b)?.find((r) => r.produk === fokus && r.agregat);
    return { bulan: b, omset: t?.omset ?? 0, spend: t?.spend ?? 0, batas: t?.targetCos ?? null };
  });

  // ④ per produk — hanya saat melihat gabungan
  const blokProduk = produk
    ? []
    : URUT_PRODUK.filter((p) => rows.some((r) => r.produk === p))
        .map((p) => rakitBlok(p, rows))
        .filter((b) => (b.total?.omset ?? 0) > 0);
  const jumlahProduk = blokProduk.reduce((a, b) => a + (b.total?.omset ?? 0), 0);

  return (
    <>
      <PageHead
        title="Marketing report"
        subtitle={`Live dari sheet · ${labelBulan(bulan)} · semua angka apa adanya dari Google Sheets`}
      />
      <Pilihan opsi={daftarBulan.map((b) => ({ nilai: b, label: labelBulan(b) }))} aktif={bulan} href={(b) => url(b, produk)} />
      <Pilihan
        opsi={[
          ...ada.filter((p) => p === ALL_BRAND).map((p) => ({ nilai: p, label: p })),
          { nilai: "", label: "Semua produk" },
          ...ada.filter((p) => p !== ALL_BRAND).map((p) => ({ nilai: p, label: p })),
        ]}
        aktif={produk ?? ""}
        href={(p) => url(bulan, p || null)}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span>
          Sumber: <strong className="font-semibold text-ink-2">{live.judul}</strong> · dibaca langsung, tanpa impor
        </span>
        <MuatUlangOtomatis diambil={live.diambil} detik={SEGAR_DETIK} awalan="Sheet dibaca" />
      </div>

      {live.catatan.length > 0 ? (
        <div
          className="mt-3 rounded-xl px-4 py-3 text-xs leading-relaxed text-ink-2"
          style={{ background: "var(--warning-bg)" }}
        >
          <strong className="font-semibold text-ink">Catatan pembacaan sheet:</strong> {live.catatan.join(" · ")}
        </div>
      ) : null}

      {/* Grafik */}
      <div className="mb-6 mt-4 grid gap-5 xl:grid-cols-2">
        <Card>
          <Judul nomor="1" judul="Dari mana omset datang?" sub={`Omset per kanal · ${fokus} · ${labelBulan(bulan)}`} />
          <div className="px-6 pb-6">
            {kontribusi.length ? <BarKontribusi rows={kontribusi} /> : <p className="text-sm text-muted">Belum ada omset.</p>}
          </div>
        </Card>
        <Card>
          <Judul
            nomor="2"
            judul="Kanal mana yang paling boros?"
            sub={`COS per kanal — makin pendek makin efisien · COS total ${persen(bagi(tot?.spend, tot?.omset))}`}
          />
          <div className="px-6 pb-6">
            {cosKanal.length ? <BarCos rows={cosKanal} /> : <p className="text-sm text-muted">Belum ada data.</p>}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-2">
        <Card>
          <Judul nomor="3" judul="Tren omset" sub={`${fokus} · ${tren.length} bulan di sheet`} />
          <div className="px-6 pb-6">
            <KolomOmset
              aktif={labelBulan(bulan)}
              titik={tren.map((t) => ({ bulan: pendek(t.bulan), panjang: labelBulan(t.bulan), nilai: t.omset }))}
            />
          </div>
        </Card>
        <Card>
          <Judul nomor="3" judul="Tren COS" sub="Dibanding batas COS tiap bulan" />
          <div className="px-6 pb-6">
            <GarisCos
              aktif={labelBulan(bulan)}
              titik={tren.map((t) => ({
                bulan: pendek(t.bulan),
                panjang: labelBulan(t.bulan),
                nilai: t.spend / (t.omset || 1),
                batas: t.batas,
              }))}
            />
          </div>
        </Card>
      </div>

      {blokProduk.length > 0 ? (
        <Card className="mb-6">
          <Judul nomor="4" judul="Per produk" sub={`Omset & COS tiap produk · ${labelBulan(bulan)}`} />
          <div className="grid gap-6 px-6 pb-6 lg:grid-cols-[3fr_2fr]">
            <BarKontribusi
              rows={blokProduk.map((b) => ({
                id: b.produk,
                label: b.produk.replace("Gamamilk ", "GM "),
                omset: b.total?.omset ?? 0,
                persen: (b.total?.omset ?? 0) / (jumlahProduk || 1),
              }))}
            />
            <ul className="space-y-3">
              {blokProduk.map((b) => (
                <li key={b.produk} className="flex items-center justify-between gap-3 border-b border-hairline/60 pb-2 last:border-0">
                  <span className="text-[15px] font-semibold text-ink">{b.produk}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-[15px] tabular-nums text-ink-2">COS {persen(bagi(b.total?.spend, b.total?.omset))}</span>
                    <StatusCos cos={bagi(b.total?.spend, b.total?.omset)} batas={b.total?.targetCos ?? null} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}

      {/* Tabel seperti di sheet */}
      <div className="mt-3">
        {tampil.map((p) => (
          <BlokProduk key={p} blok={rakitBlok(p, rows)} />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-ink-2">
        Angka diambil apa adanya dari tab GENERAL MONITORING (bulan dari nama tab; label di dalam tab kadang basi),
        diperbarui otomatis tiap {SEGAR_DETIK} detik. COS = realisasi spend ÷ omset. Omset di sini adalah omset
        sheet (rekap tim; Meta dan CRM = box × harga tetap per bulan), jadi bisa berbeda dengan halaman{" "}
        <Link href="/monitoring/kanal" className="underline underline-offset-2">Per kanal</Link> yang memakai omset dari data
        transaksi.
      </p>
    </>
  );
}
