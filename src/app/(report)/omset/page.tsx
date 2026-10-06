import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import {
  customerBaru,
  listBulan,
  mutuData,
  omsetPerAdv,
  omsetPerBulan,
  omsetPerHari,
  ringkasBulan,
} from "@/data/omset-queries";
import { OmsetView, type OmsetData } from "./OmsetView";

/* Halaman ini membaca database operasional, jadi tidak bisa
   di-prerender saat build. */
export const dynamic = "force-dynamic";

type Hasil =
  | { status: "ok"; data: OmsetData }
  | { status: "kosong" }
  | { status: "gagal"; pesan: string };

/** Bulan kalender berjalan menurut zona waktu laporan (Asia/Bangkok). */
function bulanSaatIni(): string {
  const bagian = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const tahun = bagian.find((item) => item.type === "year")!.value;
  const bulan = bagian.find((item) => item.type === "month")!.value;
  return `${tahun}-${bulan}`;
}

/** Pengambilan data dipisah dari render agar galat tertangkap di sini. */
async function ambilData(bulanDiminta?: string): Promise<Hasil> {
  try {
    const bulanData = await listBulan();
    if (bulanData.length === 0) return { status: "kosong" };

    const bulanKini = bulanSaatIni();
    const bulanTersedia = [...new Set([bulanKini, ...bulanData])].sort((a, b) =>
      b.localeCompare(a),
    );
    const bulan =
      bulanDiminta && bulanTersedia.includes(bulanDiminta)
        ? bulanDiminta
        : bulanKini;

    const [harian, ringkas, tren, perAdv, custBaru, mutu] = await Promise.all([
      omsetPerHari(bulan),
      ringkasBulan(bulan),
      omsetPerBulan(bulan, 12),
      omsetPerAdv(bulan, 10),
      customerBaru(bulan),
      mutuData(bulan),
    ]);

    /* Tanpa transaksi bulan ini, delta terhadap bulan lalu akan menyesatkan. */
    const bulanSebelum =
      ringkas.transaksi > 0
        ? (bulanData.find((item) => item < bulan) ?? null)
        : null;

    const [ringkasSebelum, custBaruSebelum] = bulanSebelum
      ? await Promise.all([
          ringkasBulan(bulanSebelum),
          customerBaru(bulanSebelum),
        ])
      : [null, null];

    return {
      status: "ok",
      data: {
        bulan,
        bulanTersedia,
        harian,
        ringkas,
        ringkasSebelum,
        bulanSebelum,
        tren,
        perAdv,
        customerBaru: custBaru,
        customerBaruSebelum: custBaruSebelum,
        mutu,
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

export default async function OmsetPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const { bulan } = await searchParams;
  const hasil = await ambilData(bulan);

  if (hasil.status === "ok") {
    return <OmsetView data={hasil.data} />;
  }

  if (hasil.status === "kosong") {
    return (
      <Pesan
        judul="Belum ada data transaksi"
        isi="Tabel data_transaksi tidak memuat baris dengan tanggal proses yang valid."
      />
    );
  }

  return (
    <Pesan
      judul="Gagal membaca database"
      isi={
        "Koneksi ke MySQL tidak berhasil. Periksa kredensial di .env.local dan " +
        "pastikan servisnya berjalan. Pesan dari driver: " +
        hasil.pesan
      }
    />
  );
}

function Pesan({ judul, isi }: { judul: string; isi: string }) {
  return (
    <>
      <PageHead title="Omset" subtitle="Data operasional dari data_transaksi" />
      <Card className="p-8">
        <p className="text-center text-sm font-semibold text-ink">{judul}</p>
        <p className="mx-auto mt-2 max-w-xl text-center text-xs leading-relaxed text-ink-2">
          {isi}
        </p>
      </Card>
    </>
  );
}
