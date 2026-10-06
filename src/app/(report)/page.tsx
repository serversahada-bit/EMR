import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import {
  omsetPerChannel,
  ringkasDashboard,
  trenDashboard,
} from "@/data/dashboard-queries";
import { listBulan } from "@/data/omset-queries";

import { DashboardView, type DashboardData } from "./DashboardView";

/* Halaman ini membaca database operasional, jadi tidak bisa
   di-prerender saat build. */
export const dynamic = "force-dynamic";

type Hasil =
  | { status: "ok"; data: DashboardData }
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

    const [ringkas, tren, channel] = await Promise.all([
      ringkasDashboard(bulan),
      trenDashboard(bulan, 12),
      omsetPerChannel(bulan),
    ]);

    /* Tanpa transaksi bulan ini, delta terhadap bulan lalu menyesatkan. */
    const bulanSebelum =
      ringkas.transaksi > 0
        ? (bulanData.find((item) => item < bulan) ?? null)
        : null;

    const ringkasSebelum = bulanSebelum
      ? await ringkasDashboard(bulanSebelum)
      : null;

    return {
      status: "ok",
      data: {
        bulan,
        bulanTersedia,
        ringkas,
        ringkasSebelum,
        bulanSebelum,
        tren,
        channel,
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const { bulan } = await searchParams;
  const hasil = await ambilData(bulan);

  if (hasil.status === "ok") {
    return <DashboardView data={hasil.data} />;
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
      <PageHead
        title="Dashboard"
        subtitle="Ikhtisar kinerja operasional"
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
