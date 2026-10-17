import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import {
  META_SOURCES,
  metaBulanSumber,
  metaSpendHarian,
} from "@/data/meta-queries";
import { grupProduk } from "@/data/produk-queries";
import { bulanSekarang, gabungBulan, gabungHarian } from "@/data/spend-grup";

import { SpendView, type SpendData } from "./SpendView";

export const dynamic = "force-dynamic";

type Hasil =
  | { status: "ok"; data: SpendData }
  | { status: "gagal"; pesan: string };

async function ambilData(
  produkDiminta?: string,
  sumberDiminta?: string,
  bulanDiminta?: string,
): Promise<Hasil> {
  try {
    /* Kartu disusun per produk, bukan per tabel: satu produk bisa punya
       satu tabel per tahun, dan tahunnya sudah dipilih lewat bulan. */
    const kartu = await grupProduk(
      "meta",
      META_SOURCES.map((s) => ({ id: s.id, label: s.label })),
    );

    const dipilih =
      kartu.find((k) => k.id === produkDiminta) ??
      /* Tautan lama memakai ?sumber=<nama tabel>; tetap dihormati. */
      kartu.find((k) => k.sumberIds.includes(sumberDiminta ?? "")) ??
      kartu.find((k) => k.sumberIds.length > 0) ??
      kartu[0];

    /* Bulan diambil dari SELURUH sumber kanal, bukan hanya produk yang
       terpilih. Kalau hanya produk terpilih, produk yang belum punya
       tabel menghasilkan daftar kosong -- pemilih bulannya lalu terisi
       satu entri mati dan terlihat seperti rusak. */
    const bulanPerSumber = await Promise.all(
      META_SOURCES.map((s) => metaBulanSumber(s.id)),
    );
    const bulanTersedia = gabungBulan(bulanPerSumber);

    const bulan =
      bulanDiminta && bulanTersedia.includes(bulanDiminta)
        ? bulanDiminta
        : (bulanTersedia[0] ?? bulanDiminta ?? bulanSekarang());

    const perSumber = await Promise.all(
      dipilih.sumberIds.map(async (id) => ({
        id,
        rows: await metaSpendHarian(id, bulan),
      })),
    );

    const label = new Map<string, string>(
      META_SOURCES.map((s) => [s.id, s.label]),
    );

    return {
      status: "ok",
      data: {
        produkId: dipilih.id,
        produkLabel: dipilih.label,
        produk: kartu.map((k) => ({
          id: k.id,
          label: k.label,
          gambar: k.gambar,
          kosong: k.sumberIds.length === 0,
        })),
        platformLabel: "Meta Ads",
        produkKosong: dipilih.sumberIds.length === 0,
        bulan,
        /* Pemilih bulan tidak boleh kosong walau produknya belum punya
           data — tanpa isi, bulan tidak bisa diganti sama sekali. */
        bulanTersedia: bulanTersedia.length > 0 ? bulanTersedia : [bulan],
        harian: gabungHarian(perSumber.map((s) => s.rows)),
        tabelDipakai: perSumber
          .filter((s) => s.rows.length > 0)
          .map((s) => label.get(s.id) ?? s.id),
        basePath: "/meta/spend-iklan",
      },
    };
  } catch (error) {
    return {
      status: "gagal",
      pesan:
        error instanceof Error ? error.message : "Penyebab tidak diketahui.",
    };
  }
}

export default async function SpendPage({
  searchParams,
}: {
  searchParams: Promise<{ produk?: string; sumber?: string; bulan?: string }>;
}) {
  const { produk, sumber, bulan } = await searchParams;
  const hasil = await ambilData(produk, sumber, bulan);

  if (hasil.status === "ok") return <SpendView data={hasil.data} />;

  return (
    <>
      <PageHead
        title="Tabel spend iklan"
        subtitle="Belanja iklan per tanggal"
      />
      <Card className="p-8">
        <p className="text-center text-sm font-semibold text-ink">
          Gagal membaca database
        </p>
        <p className="mx-auto mt-2 max-w-xl text-center text-xs leading-relaxed text-ink-2">
          Koneksi ke MySQL tidak berhasil. Periksa kredensial di .env.local.
          Pesan dari driver: {hasil.pesan}
        </p>
      </Card>
    </>
  );
}
