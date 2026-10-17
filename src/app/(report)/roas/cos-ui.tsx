import Link from "next/link";

import { TARGET_COS, type CosHari } from "@/data/cos-queries";
import { formatPercent } from "@/lib/format";

/* Dipakai bersama /roas dan /roas/cos-harian. */

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function labelBulan(b: string): string {
  const [th, bl] = b.split("-");
  return `${NAMA_BULAN[Number(bl) - 1] ?? bl} ${th}`;
}

export function bagi(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

/**
 * Hari yang benar-benar terisi. Kolom Lain-lain berisi angka template
 * (46, 35, 39, …) di SETIAP baris, jadi kalau ikut dihitung, bulan yang
 * baru berjalan dua hari tampak terisi sebulan penuh.
 */
export function hariTerisi(harian: CosHari[]): number {
  return harian.filter((h) => h.omset > 0 || h.spend - h.lainLain > 0).length;
}

/** Deretan tombol tautan untuk memilih bulan atau produk. */
export function Pilihan({
  opsi,
  aktif,
  href,
}: {
  opsi: { nilai: string; label: string }[];
  aktif: string;
  href: (nilai: string) => string;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {opsi.map((o) => (
        <Link
          key={o.nilai}
          href={href(o.nilai)}
          className={
            "rounded-xl border px-3.5 py-2 text-xs " +
            (o.nilai === aktif
              ? "border-transparent bg-ink text-surface"
              : "border-hairline bg-surface text-ink-2 hover:text-ink")
          }
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/** COS berwarna: hijau bila ≤ target 38%, merah bila di atasnya. */
export function NilaiCos({ cos }: { cos: number | null }) {
  if (cos === null) return <span className="text-muted">—</span>;
  const baik = cos <= TARGET_COS;
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 font-medium"
      style={{
        background: baik ? "var(--good-bg)" : "var(--critical-bg)",
        color: baik ? "var(--good-fg)" : "var(--critical-fg)",
      }}
    >
      {formatPercent(cos * 100)}
    </span>
  );
}

export function Angka({
  label,
  nilai,
  catatan,
}: {
  label: string;
  nilai: React.ReactNode;
  catatan?: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-ink">{nilai}</p>
      {catatan ? <p className="mt-1 text-[11px] text-muted">{catatan}</p> : null}
    </div>
  );
}

export function Tabel({
  kepala,
  baris,
  kaki,
  kosong = "Tidak ada baris pada bulan ini.",
}: {
  kepala: string[];
  baris: React.ReactNode[][];
  kaki?: React.ReactNode[];
  kosong?: string;
}) {
  return (
    <div className="overflow-x-auto px-5 pb-5">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-hairline text-left text-muted">
            {kepala.map((h, i) => (
              <th
                key={h}
                className={
                  "whitespace-nowrap py-2 font-medium " +
                  (i === 0 ? "" : "pl-3 text-right")
                }
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.length === 0 ? (
            <tr>
              <td colSpan={kepala.length} className="py-6 text-center text-ink-2">
                {kosong}
              </td>
            </tr>
          ) : (
            baris.map((r, i) => (
              <tr key={i} className="border-b border-hairline/60 last:border-0">
                {r.map((c, j) => (
                  <td
                    key={j}
                    className={
                      "whitespace-nowrap py-2 " +
                      (j === 0
                        ? "text-ink"
                        : "pl-3 text-right tabular-nums text-ink-2")
                    }
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {kaki && baris.length > 0 ? (
          <tfoot>
            <tr className="border-t border-hairline font-semibold text-ink">
              {kaki.map((c, j) => (
                <td
                  key={j}
                  className={
                    "whitespace-nowrap py-2 " +
                    (j === 0 ? "" : "pl-3 text-right tabular-nums")
                  }
                >
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
