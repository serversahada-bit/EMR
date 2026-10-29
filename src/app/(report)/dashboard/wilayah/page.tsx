import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { perWilayah, pilihBulan } from "@/data/analitik-queries";

import { WilayahView, type WilayahData } from "./WilayahView";

export const dynamic = "force-dynamic";

type Hasil = { status: "ok"; data: WilayahData } | { status: "gagal"; pesan: string };

/** Ambil data terpisah dari render supaya galat database tertangkap di sini. */
async function ambilData(diminta?: string): Promise<Hasil> {
  try {
    const { bulan, tersedia } = await pilihBulan(diminta);
    const [provinsi, kota] = await Promise.all([perWilayah(bulan, "provinsi"), perWilayah(bulan, "kota", 15)]);
    return { status: "ok", data: { bulan, tersedia, provinsi, kota } };
  } catch (e) {
    return { status: "gagal", pesan: e instanceof Error ? e.message : "penyebab tidak diketahui" };
  }
}

/** Dashboard › Wilayah — omset per provinsi & kota dari data transaksi. */
export default async function WilayahPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const { bulan } = await searchParams;
  const hasil = await ambilData(bulan);
  if (hasil.status === "ok") return <WilayahView data={hasil.data} />;
  return (
    <>
      <PageHead title="Wilayah" subtitle="Sebaran omset per provinsi dan kota" />
      <Card className="p-8 text-center text-sm text-ink-2">Gagal membaca database: {hasil.pesan}</Card>
    </>
  );
}
