import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { grupProduk } from "@/data/produk-queries";
import { mpBulanSumber, mpHarianSumber, sumberMp } from "@/data/mp-queries";
import { gabungBulan, gabungHarian } from "@/data/spend-grup";
import {
  SpendView,
  type SpendData,
} from "../../meta/spend-iklan/SpendView";

export const dynamic = "force-dynamic";

type Hasil =
  | { status: "ok"; data: SpendData }
  | { status: "belum-ada-tabel" }
  | { status: "gagal"; pesan: string };

async function ambilData(
  produkDiminta?: string,
  sumberDiminta?: string,
  bulanDiminta?: string,
): Promise<Hasil> {
  try {
    const daftar = await sumberMp();
    if (daftar.length === 0) return { status: "belum-ada-tabel" };

    const kartu = await grupProduk(
      "mp",
      daftar.map((s) => ({ id: s.id, label: s.label })),
    );

    const dipilih =
      kartu.find((k) => k.id === produkDiminta) ??
      kartu.find((k) => k.sumberIds.includes(sumberDiminta ?? "")) ??
      kartu.find((k) => k.sumberIds.length > 0) ??
      kartu[0];

    /* Bulan diambil dari SELURUH sumber kanal, bukan hanya produk yang
       terpilih -- sama seperti Meta/Google/Snack, supaya produk yang
       belum punya tabel tidak membuat pemilih bulan beku. */
    const bulanPerSumber = await Promise.all(
      daftar.map((s) => mpBulanSumber(s.id)),
    );
    const bulanTersedia = gabungBulan(bulanPerSumber);
    const bulan =
      bulanDiminta && bulanTersedia.includes(bulanDiminta)
        ? bulanDiminta
        : (bulanTersedia[0] ?? bulanDiminta ?? "");

    const perSumber = await Promise.all(
      dipilih.sumberIds.map(async (id) => ({
        id,
        rows: await mpHarianSumber(id, bulan),
      })),
    );

    /* gabungHarian() menjumlahkan spend/klik/lead; omset, box dan
       pesanan digabung di sini karena khas marketplace. */
    const dasar = gabungHarian(
      perSumber.map((s) =>
        s.rows.map((r) => ({
          tanggal: r.tanggal,
          spend: Number(r.spend),
          klik: 0,
          lead: 0,
          baris: Number(r.baris),
        })),
      ),
    );
    const tambahan = new Map<string, { omset: number; box: number; pesanan: number }>();
    for (const s of perSumber) {
      for (const r of s.rows) {
        const a = tambahan.get(r.tanggal) ?? { omset: 0, box: 0, pesanan: 0 };
        a.omset += Number(r.omset);
        a.box += Number(r.box);
        a.pesanan += Number(r.pesanan);
        tambahan.set(r.tanggal, a);
      }
    }
    const harian = dasar.map((r) => ({ ...r, ...(tambahan.get(r.tanggal) ?? {}) }));

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
        platformLabel: "Marketplace",
        produkKosong: dipilih.sumberIds.length === 0,
        bulan,
        bulanTersedia: bulanTersedia.length > 0 ? bulanTersedia : [bulan],
        harian,
        tabelDipakai: perSumber
          .filter((s) => s.rows.length > 0)
          .map((s) => label.get(s.id) ?? s.id),
        basePath: "/marketplace/spend-iklan",
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

export default async function MarketplaceSpendPage({
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
        judul="Belum ada tabel marketplace"
        isi={
          "Database belum memuat tabel bernama data_spend_mp… " +
          "Halaman ini terisi sendiri begitu tabelnya dibuat, tanpa " +
          "mengubah kode: sumbernya dibaca dari katalog database."
        }
      />
    );
  }

  return (
    <Pesan
      judul="Gagal membaca database"
      isi={
        "Koneksi ke MySQL tidak berhasil. Periksa kredensial di .env.local. " +
        "Pesan dari driver: " + hasil.pesan
      }
    />
  );
}

function Pesan({ judul, isi }: { judul: string; isi: string }) {
  return (
    <>
      <PageHead
        title="Tabel spend marketplace"
        subtitle="Belanja dan omset per tanggal"
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
