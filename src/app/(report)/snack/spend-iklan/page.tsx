import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { grupProduk } from "@/data/produk-queries";
import {
  snackBulanSumber,
  snackSources,
  snackSpendHarian,
} from "@/data/snack-queries";
import { bulanSekarang, gabungBulan, gabungHarian } from "@/data/spend-grup";

/* Komponen tampilannya dipakai bersama dengan rute Meta dan Google;
   bedanya hanya basePath, yang diteruskan lewat data. */
import { SpendView, type SpendData } from "../../meta/spend-iklan/SpendView";

export const dynamic = "force-dynamic";

type Hasil =
  | { status: "ok"; data: SpendData }
  /* Belum ada satu pun tabel data_spend_snack_* di database. */
  | { status: "belum-ada-tabel" }
  | { status: "gagal"; pesan: string };

async function ambilData(
  produkDiminta?: string,
  sumberDiminta?: string,
  bulanDiminta?: string,
): Promise<Hasil> {
  try {
    /* Id sumber selalu dipulangkan ke daftar hasil penemuan; URL tidak
       pernah menentukan nama tabel yang dibaca. */
    const daftar = await snackSources();
    if (daftar.length === 0) return { status: "belum-ada-tabel" };

    /* Kartu disusun per produk, bukan per tabel: satu produk bisa punya
       satu tabel per tahun, dan tahunnya sudah dipilih lewat bulan. */
    const kartu = await grupProduk(
      "snack",
      daftar.map((s) => ({ id: s.id, label: s.label })),
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
      daftar.map((s) => snackBulanSumber(s.id)),
    );
    const bulanTersedia = gabungBulan(bulanPerSumber);

    const bulan =
      bulanDiminta && bulanTersedia.includes(bulanDiminta)
        ? bulanDiminta
        : (bulanTersedia[0] ?? bulanDiminta ?? bulanSekarang());

    const perSumber = await Promise.all(
      dipilih.sumberIds.map(async (id) => ({
        id,
        rows: await snackSpendHarian(id, bulan),
      })),
    );

    const label = new Map(daftar.map((s) => [s.id, s.label]));

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
        platformLabel: "Snack Video",
        produkKosong: dipilih.sumberIds.length === 0,
        bulan,
        /* Pemilih bulan tidak boleh kosong walau produknya belum punya
           data — tanpa isi, bulan tidak bisa diganti sama sekali. */
        bulanTersedia: bulanTersedia.length > 0 ? bulanTersedia : [bulan],
        harian: gabungHarian(perSumber.map((s) => s.rows)),
        tabelDipakai: perSumber
          .filter((s) => s.rows.length > 0)
          .map((s) => label.get(s.id) ?? s.id),
        basePath: "/snack/spend-iklan",
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

export default async function SnackSpendPage({
  searchParams,
}: {
  searchParams: Promise<{ produk?: string; sumber?: string; bulan?: string }>;
}) {
  const { produk, sumber, bulan } = await searchParams;
  const hasil = await ambilData(produk, sumber, bulan);

  if (hasil.status === "ok") return <SpendView data={hasil.data} />;

  if (hasil.status === "belum-ada-tabel") {
    return (
      <Pesan
        judul="Belum ada tabel spend Snack Video"
        isi={
          "Database belum memuat tabel bernama data_spend_snack… " +
          "Halaman ini akan langsung terisi begitu tabelnya dibuat, tanpa " +
          "perlu mengubah kode: sumbernya dibaca dari katalog database."
        }
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
        title="Tabel spend iklan Snack Video"
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
