import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import {
  META_SOURCES,
  metaBulanSumber,
  metaSpendHarian,
} from "@/data/meta-queries";

import { SpendView, type SpendData } from "./SpendView";

export const dynamic = "force-dynamic";

type Hasil =
  | { status: "ok"; data: SpendData }
  | { status: "kosong" }
  | { status: "gagal"; pesan: string };

async function ambilData(
  sumberDiminta?: string,
  bulanDiminta?: string,
): Promise<Hasil> {
  try {
    /* Id sumber selalu dipulangkan ke daftar tetap; URL tidak pernah
       menentukan nama tabel yang dibaca. */
    const sumber =
      META_SOURCES.find((s) => s.id === sumberDiminta) ?? META_SOURCES[0];

    const bulanTersedia = await metaBulanSumber(sumber.id);
    if (bulanTersedia.length === 0) return { status: "kosong" };

    const bulan =
      bulanDiminta && bulanTersedia.includes(bulanDiminta)
        ? bulanDiminta
        : bulanTersedia[0];

    return {
      status: "ok",
      data: {
        sumberId: sumber.id,
        sumberLabel: sumber.label,
        sumber: META_SOURCES.map((s) => ({ id: s.id, label: s.label })),
        bulan,
        bulanTersedia,
        harian: await metaSpendHarian(sumber.id, bulan),
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
  searchParams: Promise<{ sumber?: string; bulan?: string }>;
}) {
  const { sumber, bulan } = await searchParams;
  const hasil = await ambilData(sumber, bulan);

  if (hasil.status === "ok") return <SpendView data={hasil.data} />;

  if (hasil.status === "kosong") {
    return (
      <Pesan
        judul="Sumber ini belum punya data"
        isi="Tabel spend untuk sumber terpilih tidak memuat baris dengan tanggal yang valid."
      />
    );
  }

  return (
    <Pesan
      judul="Gagal membaca database"
      isi={
        "Koneksi ke MySQL tidak berhasil. Periksa kredensial di .env.local. " +
        "Pesan dari driver: " +
        hasil.pesan
      }
    />
  );
}

function Pesan({ judul, isi }: { judul: string; isi: string }) {
  return (
    <>
      <PageHead
        title="Tabel spend iklan"
        subtitle="Belanja iklan per tanggal"
      />
      <Card className="p-8">
        <p className="text-center text-sm font-semibold text-ink">{judul}</p>
        <p className="mx-auto mt-2 max-w-xl text-center text-xs leading-relaxed text-ink-2">
          {isi}
        </p>
      </Card>
    </>
  );
}
