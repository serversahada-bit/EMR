import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import {
  metodeBayar,
  pilihBulan,
  polaWaktu,
  ringkasPenjualan,
  tanpaJam,
  ukuranPesanan,
} from "@/data/analitik-queries";
import { hariSetara } from "@/data/omset-queries";

import { PenjualanView, type PenjualanData } from "./PenjualanView";

export const dynamic = "force-dynamic";

type Hasil = { status: "ok"; data: PenjualanData } | { status: "gagal"; pesan: string };

/** Ambil data terpisah dari render supaya galat database tertangkap di sini. */
async function ambilData(diminta?: string): Promise<Hasil> {
  try {
    const { bulan, tersedia, sebelum } = await pilihBulan(diminta);
    const [ringkas, metode, jam, hari, ukuran, nolJam] = await Promise.all([
      ringkasPenjualan(bulan),
      metodeBayar(bulan),
      polaWaktu(bulan, "jam"),
      polaWaktu(bulan, "hari"),
      ukuranPesanan(bulan),
      tanpaJam(bulan),
    ]);
    /* Pembanding setara: bulan berjalan 1–N lawan bulan lalu 1–N. */
    const hari1N = sebelum && ringkas.transaksi > 0 ? hariSetara(bulan, sebelum, ringkas.hariTerakhir) : null;
    const lalu = sebelum && ringkas.transaksi > 0 ? await ringkasPenjualan(sebelum, hari1N ?? undefined) : null;
    return { status: "ok", data: { bulan, tersedia, sebelum, hari1N, ringkas, lalu, metode, jam, hari, ukuran, nolJam } };
  } catch (e) {
    return { status: "gagal", pesan: e instanceof Error ? e.message : "penyebab tidak diketahui" };
  }
}

/** Dashboard › Penjualan — pola transaksi dari data_transaksi. */
export default async function PenjualanPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const { bulan } = await searchParams;
  const hasil = await ambilData(bulan);
  if (hasil.status === "ok") return <PenjualanView data={hasil.data} />;
  return (
    <>
      <PageHead title="Penjualan" subtitle="Analitik penjualan dari data transaksi" />
      <Card className="p-8 text-center text-sm text-ink-2">Gagal membaca database: {hasil.pesan}</Card>
    </>
  );
}
