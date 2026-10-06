import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import {
  daftarCustomer,
  daftarProvinsi,
  daftarTahun,
  ringkasCustomer,
} from "@/data/customer-queries";

import { CustomerView, type CustomerData } from "./CustomerView";

export const dynamic = "force-dynamic";

type Hasil =
  | { status: "ok"; data: CustomerData }
  | { status: "gagal"; pesan: string };

async function ambilData(
  cari?: string,
  provinsi?: string,
  tahun?: string,
  hal?: string,
): Promise<Hasil> {
  try {
    const halaman = Number(hal);
    const tahunAngka = Number(tahun);
    const tahunDipakai =
      Number.isInteger(tahunAngka) && tahunAngka > 1970
        ? tahunAngka
        : undefined;

    const [ringkas, halamanData, provinsiPilihan, tahunPilihan] =
      await Promise.all([
        ringkasCustomer(),
        daftarCustomer({
          cari,
          provinsi,
          tahun: tahunDipakai,
          halaman: Number.isFinite(halaman) && halaman > 0 ? halaman : 1,
        }),
        daftarProvinsi(),
        daftarTahun(),
      ]);

    return {
      status: "ok",
      data: {
        ringkas,
        halaman: halamanData,
        provinsiPilihan,
        tahunPilihan,
        cari: cari ?? "",
        provinsi: provinsi ?? "",
        tahun: tahunDipakai ? String(tahunDipakai) : "",
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

export default async function CustomerPage({
  searchParams,
}: {
  searchParams: Promise<{
    cari?: string;
    provinsi?: string;
    tahun?: string;
    hal?: string;
  }>;
}) {
  const { cari, provinsi, tahun, hal } = await searchParams;
  const hasil = await ambilData(cari, provinsi, tahun, hal);

  if (hasil.status === "ok") return <CustomerView data={hasil.data} />;

  return (
    <>
      <PageHead
        title="Data customer"
        subtitle="Daftar customer dari data_customer"
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
