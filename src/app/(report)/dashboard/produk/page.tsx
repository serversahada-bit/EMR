import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { perProduk, pilihBulan, ringkasPenjualan, trenProduk } from "@/data/analitik-queries";
import { hariSetara } from "@/data/omset-queries";

import { ProdukView, type ProdukData } from "./ProdukView";

export const dynamic = "force-dynamic";

type Hasil = { status: "ok"; data: ProdukData } | { status: "gagal"; pesan: string };

/** Ambil data terpisah dari render supaya galat database tertangkap di sini. */
async function ambilData(diminta?: string): Promise<Hasil> {
  try {
    const { bulan, tersedia, sebelum } = await pilihBulan(diminta);
    /* Tren 12 bulan (±2,5 dtk saat pertama) TIDAK ditunggu — menyusul lewat <Tunggu>. */
    const tren = trenProduk(bulan, 12).catch(() => null);
    const [produk, ringkas] = await Promise.all([perProduk(bulan), ringkasPenjualan(bulan)]);
    const hari1N = sebelum && ringkas.transaksi > 0 ? hariSetara(bulan, sebelum, ringkas.hariTerakhir) : null;
    const lalu = sebelum && ringkas.transaksi > 0 ? await perProduk(sebelum, hari1N ?? undefined) : [];
    return { status: "ok", data: { bulan, tersedia, sebelum, hari1N, produk, lalu, tren } };
  } catch (e) {
    return { status: "gagal", pesan: e instanceof Error ? e.message : "penyebab tidak diketahui" };
  }
}

/** Dashboard › Produk — omset & box per produk (per baris barang, bukan barang pertama saja). */
export default async function ProdukPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const { bulan } = await searchParams;
  const hasil = await ambilData(bulan);
  if (hasil.status === "ok") return <ProdukView data={hasil.data} />;
  return (
    <>
      <PageHead title="Produk" subtitle="Performa per produk dari data transaksi" />
      <Card className="p-8 text-center text-sm text-ink-2">Gagal membaca database: {hasil.pesan}</Card>
    </>
  );
}
