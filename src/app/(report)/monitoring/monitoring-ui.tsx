import { Card, CardHead } from "@/components/Card";
import { URUT_KANAL, type BarisMonitoring } from "@/data/monitoring-queries";
import { formatCount, formatIDRPenuh, formatPercent } from "@/lib/format";

/* Dipakai bersama /monitoring dan /monitoring/kanal. Rumus rasio sama
   dengan tab GENERAL MONITORING di sheet Marketing Report. */

export const bagi = (a: number | null | undefined, b: number | null | undefined) =>
  a !== null && a !== undefined && b ? a / b : null;

const persen = (x: number | null) => (x === null || !Number.isFinite(x) ? "—" : formatPercent(x * 100, 2));
const rp = (x: number | null) => (x === null ? "—" : formatIDRPenuh(x));
const jml = (x: number | null) => (x === null ? "—" : formatCount(x));
const kali = (x: number | null) => (x === null || !Number.isFinite(x) ? "—" : x.toFixed(2).replace(".", ","));

export interface Blok {
  produk: string;
  kanal: BarisMonitoring[];          // tanpa TOTAL, urut
  total: BarisMonitoring | null;     // baris TOTAL sheet (omset neto + target)
  omsetKotor: number;                // jumlah omset kanal
  cosEcom: number | null;
  cosSoscom: number | null;
}

const sum = (rs: BarisMonitoring[], f: (r: BarisMonitoring) => number | null) =>
  rs.reduce((a, r) => a + (f(r) ?? 0), 0);

/** Rakit satu blok produk dari baris-baris bulan itu. */
export function rakitBlok(produk: string, rows: BarisMonitoring[]): Blok {
  const milik = rows.filter((r) => r.produk === produk);
  const kanal = milik
    .filter((r) => !r.agregat)
    .sort((a, b) => URUT_KANAL.indexOf(a.kanal) - URUT_KANAL.indexOf(b.kanal));
  const total = milik.find((r) => r.agregat) ?? null;
  const ecom = kanal.filter((r) => r.grup === "ECOMMERCE");
  const sos = kanal.filter((r) => r.grup === "SOSCOM");
  return {
    produk,
    kanal,
    total,
    omsetKotor: sum(kanal, (r) => r.omset),
    // sheet C12: (META x SHOPEE + TIKTOK + MP spend) / (TIKTOK + MP omset)
    cosEcom: bagi(sum(ecom, (r) => r.spend), sum(ecom, (r) => r.omset)),
    // sheet F12: (META + CRM spend) / (META + CRM omset)
    cosSoscom: bagi(sum(sos, (r) => r.spend), sum(sos, (r) => r.omset)),
  };
}

/** COS berwarna terhadap batasnya. */
export function Cos({ nilai, batas }: { nilai: number | null; batas: number | null }) {
  if (nilai === null || !Number.isFinite(nilai)) return <span className="text-muted">—</span>;
  if (batas === null) return <span>{persen(nilai)}</span>;
  const baik = nilai <= batas;
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 font-medium"
      style={{
        background: baik ? "var(--good-bg)" : "var(--critical-bg)",
        color: baik ? "var(--good-fg)" : "var(--critical-fg)",
      }}
    >
      {persen(nilai)}
    </span>
  );
}

/** Blok per produk — baris metrik x kolom kanal, seperti di sheet. */
export function BlokProduk({ blok }: { blok: Blok }) {
  const { kanal, total } = blok;
  const totAlokasi = total?.alokasi ?? sum(kanal, (r) => r.alokasi);
  const totSpend = total?.spend ?? sum(kanal, (r) => r.spend);
  const totBox = total?.box ?? sum(kanal, (r) => r.box);
  const totClosing = total?.closing ?? sum(kanal, (r) => r.closing);
  const totOmset = total?.omset ?? blok.omsetKotor;
  const penyesuaian = blok.omsetKotor - totOmset;
  const kolom = [...kanal, null]; // null = TOTAL
  const nilai = (r: BarisMonitoring | null, f: (x: BarisMonitoring) => number | null, t: number | null) =>
    r ? f(r) : t;

  const baris: [string, (r: BarisMonitoring | null) => React.ReactNode][] = [
    ["Alokasi", (r) => rp(nilai(r, (x) => x.alokasi, totAlokasi))],
    ["% Alokasi", (r) => persen(bagi(nilai(r, (x) => x.alokasi, totAlokasi), totAlokasi))],
    ["Realisasi spend", (r) => rp(nilai(r, (x) => x.spend, totSpend))],
    ["Box", (r) => jml(nilai(r, (x) => x.box, totBox))],
    ["Closing", (r) => jml(nilai(r, (x) => x.closing, totClosing))],
    ["Upsell", (r) => kali(bagi(nilai(r, (x) => x.box, totBox), nilai(r, (x) => x.closing, totClosing)))],
    [
      "COS",
      (r) => {
        const sp = nilai(r, (x) => x.spend, totSpend);
        const om = nilai(r, (x) => x.omset, totOmset);
        // MARKOM (grup LAIN) tidak punya COS di sheet; omsetnya kadang berisi sisa sel
        return r && (!om || r.grup === "LAIN") ? "—" : <Cos nilai={bagi(sp, om)} batas={r ? null : total?.targetCos ?? null} />;
      },
    ],
    ["Rasio kontribusi (box)", (r) => persen(bagi(nilai(r, (x) => x.box, totBox), totBox))],
    ["Omset", (r) => rp(nilai(r, (x) => x.omset, totOmset))],
    ["Rasio omset", (r) => persen(bagi(nilai(r, (x) => x.omset, totOmset), totOmset))],
    ["ROAS", (r) => (r?.grup === "LAIN" ? "—" : kali(bagi(nilai(r, (x) => x.omset, totOmset), nilai(r, (x) => x.spend, totSpend))))],
    ["CA customer", (r) => rp(bagi(nilai(r, (x) => x.spend, totSpend), nilai(r, (x) => x.closing, totClosing)))],
  ];

  const capaian = bagi(totBox, total?.targetBox ?? null);

  return (
    <Card className="mb-5">
      <CardHead
        title={blok.produk}
        subtitle={`Omset ${rp(totOmset)} · COS ${persen(bagi(totSpend, totOmset))} · box ${jml(totBox)}${
          total?.targetBox ? ` dari target ${jml(total.targetBox)}` : ""
        }`}
      />
      <div className="overflow-x-auto px-5 pb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-hairline text-muted">
              <th className="py-2 text-left font-medium" />
              {kolom.map((r, i) => (
                <th key={i} className="whitespace-nowrap py-2 pl-3 text-right font-medium">
                  {r ? r.kanal : "TOTAL"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map(([lab, f]) => (
              <tr key={lab} className="border-b border-hairline/60 last:border-0">
                <td className="whitespace-nowrap py-2 font-medium text-ink">{lab}</td>
                {kolom.map((r, i) => (
                  <td
                    key={i}
                    className={
                      "whitespace-nowrap py-2 pl-3 text-right tabular-nums " +
                      (r ? "text-ink-2" : "font-semibold text-ink")
                    }
                  >
                    {f(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 border-t border-hairline px-5 py-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Capaian box" nilai={persen(capaian)} catatan={total?.targetBox ? `target ${jml(total.targetBox)}` : "tanpa target"} />
        <Kpi
          label="COS total"
          nilai={<Cos nilai={bagi(totSpend, totOmset)} batas={total?.targetCos ?? null} />}
          catatan={total?.targetCos ? `batas ≤ ${persen(total.targetCos)}` : "tanpa batas"}
        />
        <Kpi
          label="COS META x ECOMMERCE"
          nilai={<Cos nilai={blok.cosEcom} batas={total?.targetCosEcom ?? null} />}
          catatan={total?.targetCosEcom ? `batas ≤ ${persen(total.targetCosEcom)}` : "META x SHOPEE + TikTok + MP"}
        />
        <Kpi
          label="COS SOSCOM"
          nilai={<Cos nilai={blok.cosSoscom} batas={total?.targetCosSoscom ?? null} />}
          catatan={total?.targetCosSoscom ? `batas ≤ ${persen(total.targetCosSoscom)}` : "META + CRM"}
        />
      </div>
      {penyesuaian > 1 ? (
        <p className="px-5 pb-4 text-[11px] text-muted">
          Omset TOTAL = jumlah omset kanal {rp(blok.omsetKotor)} dikurangi penyesuaian {rp(penyesuaian)} (input
          manual per pekan di sheet, kemungkinan retur).
        </p>
      ) : null}
    </Card>
  );
}

function Kpi({ label, nilai, catatan }: { label: string; nilai: React.ReactNode; catatan: string }) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{nilai}</p>
      <p className="text-[11px] text-muted">{catatan}</p>
    </div>
  );
}
