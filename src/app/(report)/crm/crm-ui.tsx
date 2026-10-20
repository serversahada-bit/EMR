import { labelBulan, Pilihan } from "../roas/cos-ui";

/* Dipakai bersama /crm, /crm/blast, /crm/cs, /crm/ro. */

/** Nilai ?produk= untuk "Semua produk" — beda dari "tidak diisi" (= default). */
export const SEMUA = "semua";

export type ParamCrm = Record<string, string | null | undefined>;

/** Susun URL dengan parameter yang diberi; nilai kosong dibuang. */
export function urlCrm(path: string, p: ParamCrm): string {
  const q = Object.entries(p)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join("&");
  return q ? `${path}?${q}` : path;
}

/** Pilihan bulan + produk ("Semua produk" bila `semua` true). */
export function PilihBulanProduk({
  path,
  bulan,
  daftarBulan,
  produk,
  daftarProduk,
  semua = true,
  lain = {},
}: {
  path: string;
  bulan: string;
  daftarBulan: string[];
  produk: string | null;
  daftarProduk: string[];
  semua?: boolean;
  lain?: ParamCrm;
}) {
  return (
    <>
      <Pilihan
        opsi={daftarBulan.map((b) => ({ nilai: b, label: labelBulan(b) }))}
        aktif={bulan}
        href={(b) => urlCrm(path, { ...lain, bulan: b, produk: produk ?? SEMUA })}
      />
      <Pilihan
        opsi={[
          ...(semua ? [{ nilai: SEMUA, label: "Semua produk" }] : []),
          ...daftarProduk.map((p) => ({ nilai: p, label: p })),
        ]}
        aktif={produk ?? SEMUA}
        href={(p) => urlCrm(path, { ...lain, bulan, produk: p })}
      />
    </>
  );
}

/** Pilih bulan/produk dari URL, jatuh ke default yang sah. */
export function pilihDari(
  diminta: { bulan?: string; produk?: string },
  daftarBulan: string[],
  daftarProduk: string[],
  produkDefault: string | null = null,
): { bulan: string; produk: string | null } {
  const bulan =
    diminta.bulan && daftarBulan.includes(diminta.bulan) ? diminta.bulan : daftarBulan[0] ?? "";
  const produk =
    diminta.produk === undefined
      ? produkDefault
      : diminta.produk !== SEMUA && daftarProduk.includes(diminta.produk)
        ? diminta.produk
        : null;
  return { bulan, produk };
}
