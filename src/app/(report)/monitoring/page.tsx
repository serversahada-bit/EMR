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

import { labelBulan, Pilihan, Tabel } from "../roas/cos-ui";
import { BarCos, BarKontribusi, GarisCos, KolomOmset, StatusCos } from "./ceo-charts";
import { bagi, BlokProduk, Cos, rakitBlok, type Blok } from "./monitoring-ui";

export const dynamic = "force-dynamic";

const persen = (x: number | null) => (x === null ? "—" : formatPercent(x * 100, 1));
const pendek = (b: string) => labelBulan(b).slice(0, 3);

/**
 * Marketing report — VERSI CEO (grafik, huruf besar). Angka diambil dari
 * blok ALL BRAND sheet; tabel lengkap seperti sheet tetap ada di bawah,
 * tertutup di balik "Lihat angka detail" (untuk staf).
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
  const bulanLalu = daftarBulan[daftarBulan.indexOf(bulan) + 1] ?? null;
  const [rows, rowsLalu, tren] = await Promise.all([
    dataMonitoring(bulan),
    bulanLalu ? dataMonitoring(bulanLalu) : Promise.resolve([]),
    trenMonitoring(),
  ]);

  const semua = ringkas(rows);
  const lalu = bulanLalu ? ringkas(rowsLalu) : null;
  const tot = semua.total;
  const omset = tot?.omset ?? semua.omsetKotor;
  const spend = tot?.spend ?? 0;
  const cos = bagi(spend, omset);
  const sekarang = new Date();
  const berjalan = bulan === `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}`;

  // ① kontribusi omset per kanal (porsi dari jumlah omset kanal, total 100%)
  const kanalOmset = semua.kanal.filter((k) => (k.omset ?? 0) > 0 && k.grup !== "LAIN");
  const jumlahKanal = kanalOmset.reduce((a, k) => a + (k.omset ?? 0), 0);
  const kontribusi = [...kanalOmset]
    .sort((a, b) => (b.omset ?? 0) - (a.omset ?? 0))
    .map((k) => ({ id: k.kanal, label: judulKanal(k.kanal), omset: k.omset ?? 0, persen: (k.omset ?? 0) / (jumlahKanal || 1) }));

  // ② COS per kanal vs batas kelompoknya
  const batasKanal = (k: BarisMonitoring) =>
    (k.grup === "ECOMMERCE" ? tot?.targetCosEcom : k.grup === "SOSCOM" ? tot?.targetCosSoscom : null) ?? tot?.targetCos ?? null;
  const cosKanal = kanalOmset
    .map((k) => ({ id: k.kanal, label: judulKanal(k.kanal), cos: (k.spend ?? 0) / (k.omset || 1), batas: batasKanal(k) }))
    .sort((a, b) => a.cos - b.cos);

  // ④ per produk
  const produk = URUT_PRODUK.filter((p) => rows.some((r) => r.produk === p))
    .map((p) => rakitBlok(p, rows))
    .filter((b) => (b.total?.omset ?? 0) > 0);
  const jumlahProduk = produk.reduce((a, b) => a + (b.total?.omset ?? 0), 0);

  return (
    <>
      <PageHead
        title="Marketing report"
        subtitle={`Semua brand · ${labelBulan(bulan)}${berjalan ? " (bulan berjalan, belum lengkap)" : ""}`}
      />
      <Pilihan opsi={daftarBulan.map((b) => ({ nilai: b, label: labelBulan(b) }))} aktif={bulan} href={(b) => `/monitoring?bulan=${b}`} />

      {/* Kartu KPI besar */}
      <div className="mb-6 mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kartu judul="Omset" nilai={formatIDR(omset)} banding={banding(omset, lalu?.omset, bulanLalu, true)} />
        <Kartu judul="Biaya (spend)" nilai={formatIDR(spend)} banding={banding(spend, lalu?.spend, bulanLalu, false)} />
        <Kartu
          judul="COS (biaya ÷ omset)"
          nilai={persen(cos)}
          status={<StatusCos cos={cos} batas={tot?.targetCos ?? null} besar />}
          catatan={tot?.targetCos ? `Batas aman ≤ ${persen(tot.targetCos)}` : undefined}
        />
        <Kartu
          judul="Box terjual"
          nilai={formatCount(tot?.box ?? 0)}
          capaian={tot?.targetBox ? bagi(tot.box, tot.targetBox) : null}
          catatan={tot?.targetBox ? `Target ${formatCount(tot.targetBox)} box` : undefined}
        />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-2">
        <Card>
          <Judul nomor="1" judul="Dari mana omset datang?" sub={`Omset per kanal, ${labelBulan(bulan)}`} />
          <div className="px-6 pb-6"><BarKontribusi rows={kontribusi} /></div>
        </Card>
        <Card>
          <Judul nomor="2" judul="Kanal mana yang paling boros?" sub="COS per kanal — makin pendek makin efisien" />
          <div className="px-6 pb-6"><BarCos rows={cosKanal} /></div>
        </Card>
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-2">
        <Card>
          <Judul nomor="3" judul="Tren omset" sub={`${tren.length} bulan terakhir`} />
          <div className="px-6 pb-6">
            <KolomOmset aktif={labelBulan(bulan)} titik={tren.map((t) => ({ bulan: pendek(t.bulan), panjang: labelBulan(t.bulan), nilai: t.omset }))} />
          </div>
        </Card>
        <Card>
          <Judul nomor="3" judul="Tren COS" sub="Dibanding batas COS tiap bulan" />
          <div className="px-6 pb-6">
            <GarisCos
              aktif={labelBulan(bulan)}
              titik={tren.map((t) => ({ bulan: pendek(t.bulan), panjang: labelBulan(t.bulan), nilai: t.spend / (t.omset || 1), batas: t.targetCos }))}
            />
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <Judul nomor="4" judul="Per produk" sub={`Omset & COS tiap produk, ${labelBulan(bulan)}`} />
        <div className="grid gap-6 px-6 pb-6 lg:grid-cols-[3fr_2fr]">
          <BarKontribusi
            rows={produk.map((b) => ({ id: b.produk, label: b.produk.replace("Gamamilk ", "GM "), omset: b.total?.omset ?? 0, persen: (b.total?.omset ?? 0) / (jumlahProduk || 1) }))}
          />
          <ul className="space-y-3">
            {produk.map((b) => (
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

      {/* Untuk staf: angka lengkap seperti sheet */}
      <details className="group mb-4 rounded-2xl border border-hairline bg-surface">
        <summary className="cursor-pointer select-none px-6 py-4 text-[15px] font-semibold text-ink">
          Lihat angka detail (tabel seperti di sheet)
        </summary>
        <div className="px-1 pb-2">
          <BlokProduk blok={semua} />
          <Card className="mx-5 mb-5">
            <CardHead title="Per produk" subtitle={labelBulan(bulan)} />
            <Tabel
              kepala={["Produk", "Omset", "Kontribusi omset", "Spend", "COS", "Batas COS", "Box", "Capaian box"]}
              baris={produk.map((b) => [
                b.produk,
                formatIDR(b.total?.omset ?? 0),
                persen(bagi(b.total?.omset, omset)),
                formatIDR(b.total?.spend ?? 0),
                <Cos key="c" nilai={bagi(b.total?.spend, b.total?.omset)} batas={b.total?.targetCos ?? null} />,
                b.total?.targetCos ? `≤ ${persen(b.total.targetCos)}` : "—",
                formatCount(b.total?.box ?? 0),
                persen(bagi(b.total?.box, b.total?.targetBox)),
              ])}
            />
          </Card>
          <Card className="mx-5 mb-5">
            <CardHead title="Tren bulanan" subtitle="Blok ALL BRAND di sheet" />
            <Tabel
              kepala={["Bulan", "Omset", "Spend", "COS", "Batas COS", "Box", "Target box", "Capaian"]}
              baris={tren.map((t) => [
                labelBulan(t.bulan),
                formatIDR(t.omset),
                formatIDR(t.spend),
                persen(bagi(t.spend, t.omset)),
                t.targetCos ? `≤ ${persen(t.targetCos)}` : "—",
                formatCount(t.box),
                t.targetBox ? formatCount(t.targetBox) : "—",
                persen(bagi(t.box, t.targetBox)),
              ])}
            />
          </Card>
        </div>
      </details>
      <p className="text-sm leading-relaxed text-ink-2">
        Sumber: spreadsheet &quot;Marketing Report Sahada&quot;, blok ALL BRAND tab GENERAL MONITORING. COS = biaya ÷ omset;
        makin kecil makin efisien. Omset Meta & CRM di sheet dihitung dari box × harga per box.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */

/** Blok ALL BRAND dari sheet; bila tak ada, jumlah blok produk. */
function ringkas(rows: BarisMonitoring[]): Blok & { omset: number; spend: number } {
  let b: Blok;
  if (rows.some((r) => r.produk === ALL_BRAND)) {
    b = rakitBlok(ALL_BRAND, rows);
  } else {
    const gabung: BarisMonitoring[] = [];
    for (const k of URUT_KANAL) {
      const rs = rows.filter((r) => r.kanal === k);
      if (!rs.length) continue;
      const s = (f: (r: BarisMonitoring) => number | null) => rs.reduce((a, r) => a + (f(r) ?? 0), 0);
      gabung.push({
        produk: "Semua produk", kanal: k, grup: rs[0].grup, agregat: k === "TOTAL" ? 1 : 0,
        alokasi: s((r) => r.alokasi), spend: s((r) => r.spend), box: s((r) => r.box), closing: s((r) => r.closing),
        omset: s((r) => r.omset), targetBox: k === "TOTAL" ? s((r) => r.targetBox) : null,
        targetCos: null, targetCosEcom: null, targetCosSoscom: null,
      });
    }
    b = rakitBlok("Semua produk", gabung);
  }
  return { ...b, omset: b.total?.omset ?? b.omsetKotor, spend: b.total?.spend ?? 0 };
}

function judulKanal(k: string): string {
  return { "META x SHOPEE": "Meta×Shopee", TIKTOK: "TikTok", MP: "Marketplace", META: "Meta (iklan)", SNACK: "Snack", CRM: "CRM" }[k] ?? k;
}

/** "▲ 12% dibanding September" — naik baik untuk omset, buruk untuk biaya. */
function banding(kini: number, dulu: number | undefined, bulanLalu: string | null, naikBaik: boolean) {
  if (!bulanLalu || !dulu) return null;
  const d = (kini - dulu) / dulu;
  const baik = naikBaik ? d >= 0 : d <= 0;
  return { teks: `${d >= 0 ? "▲" : "▼"} ${Math.abs(d * 100).toFixed(0)}% dibanding ${labelBulan(bulanLalu).split(" ")[0]}`, baik };
}

function Judul({ nomor, judul, sub }: { nomor: string; judul: string; sub: string }) {
  return (
    <header className="flex items-start gap-3 px-6 pb-4 pt-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-surface">{nomor}</span>
      <div>
        <h2 className="text-[19px] font-semibold leading-tight text-ink">{judul}</h2>
        <p className="mt-1 text-sm text-ink-2">{sub}</p>
      </div>
    </header>
  );
}

function Kartu({
  judul, nilai, banding: b, status, catatan, capaian,
}: {
  judul: string;
  nilai: string;
  banding?: { teks: string; baik: boolean } | null;
  status?: React.ReactNode;
  catatan?: string;
  capaian?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface px-6 py-5 shadow-[0_1px_2px_rgba(11,11,11,0.04)]">
      <p className="text-[15px] font-semibold text-ink-2">{judul}</p>
      <p className="mt-2 text-[34px] font-bold leading-none tracking-tight text-ink">{nilai}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px]">
        {status}
        {b ? (
          <span className="font-semibold" style={{ color: b.baik ? "var(--good-fg)" : "var(--critical-fg)" }}>{b.teks}</span>
        ) : null}
      </div>
      {capaian != null ? (
        <div className="mt-3">
          <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: "var(--seq-100)" }}
               role="img" aria-label={`Capaian ${Math.round(capaian * 100)} persen dari target`}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(capaian, 1) * 100}%`, background: capaian >= 1 ? "var(--good)" : "var(--s1)" }} />
          </div>
          <p className="mt-1.5 text-[15px] font-semibold text-ink">{Math.round(capaian * 100)}% dari target</p>
        </div>
      ) : null}
      {catatan ? <p className="mt-1.5 text-sm text-ink-2">{catatan}</p> : null}
    </div>
  );
}
