import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { snackSourceMonths } from "@/data/snack-queries";
import { bulanSekarang } from "@/data/spend-grup";
import { SnackView, type SnackReportData } from "./SnackView";

export const dynamic = "force-dynamic";

type Hasil =
  | { status: "ok"; data: SnackReportData }
  /* Tabelnya ada tapi tidak memuat tanggal yang bisa dipakai. */
  | { status: "kosong" }
  /* Belum ada satu pun tabel data_spend_snack_* di database. */
  | { status: "belum-ada-tabel" }
  | { status: "gagal"; pesan: string };

async function ambilData(diminta?: string): Promise<Hasil> {
  try {
    const { sources, months } = await snackSourceMonths();
    if (sources.length === 0) return { status: "belum-ada-tabel" };
    if (months.length === 0) return { status: "kosong" };

    const bulanKini = bulanSekarang();
    const pilihan = [
      ...new Set([bulanKini, ...months.map((row) => row.month)]),
    ].sort((a, b) => b.localeCompare(a));
    const bulan = diminta && pilihan.includes(diminta) ? diminta : bulanKini;

    const totals = new Map<string, SnackReportData["monthly"][number]>();
    for (const row of months) {
      const current = totals.get(row.month) ?? {
        month: row.month,
        spend: 0,
        records: 0,
        sources: 0,
        lastDate: "",
      };
      current.spend += row.spend;
      current.records += row.records;
      current.sources += 1;
      if (row.lastDate > current.lastDate) current.lastDate = row.lastDate;
      totals.set(row.month, current);
    }
    /* Bulan berjalan selalu ikut muncul walau belum ada barisnya, supaya
       pemilih bulan tidak melompati bulan yang sedang dijalani. */
    if (!totals.has(bulanKini)) {
      totals.set(bulanKini, {
        month: bulanKini,
        spend: 0,
        records: 0,
        sources: 0,
        lastDate: "",
      });
    }

    const monthly = [...totals.values()].sort((a, b) =>
      a.month.localeCompare(b.month),
    );
    const bySource = sources.map((source) => {
      const cocok = months.find(
        (row) => row.month === bulan && row.sourceId === source.id,
      );
      return {
        id: source.id,
        label: source.label,
        table: source.table,
        spend: cocok?.spend ?? 0,
        records: cocok?.records ?? 0,
      };
    });

    return {
      status: "ok",
      data: {
        bulan,
        bulanKini,
        pilihan,
        monthly,
        bySource,
        totalSumber: sources.length,
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

export default async function SnackPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const { bulan } = await searchParams;
  const hasil = await ambilData(bulan);

  if (hasil.status === "ok") return <SnackView data={hasil.data} />;

  if (hasil.status === "belum-ada-tabel") {
    return (
      <Pesan
        judul="Belum ada tabel spend Snack Video"
        isi={
          "Database belum memuat tabel bernama data_spend_snack… " +
          "Di file Progres, datanya ada di sheet berakhiran “(SNACK)” " +
          "seperti ADV GUSTI (SNACK) dan ADV PUTRA (SNACK), dengan banner " +
          "SNACKVIDEO GAMAMILK. Halaman ini akan langsung terisi begitu " +
          "tabelnya dibuat, tanpa perlu mengubah kode: sumbernya dibaca " +
          "dari katalog database."
        }
      />
    );
  }

  if (hasil.status === "kosong") {
    return (
      <Pesan
        judul="Belum ada data Snack Video"
        isi="Tabel spend Snack sudah ada tetapi belum memuat baris dengan tanggal yang valid."
      />
    );
  }

  return <Pesan judul="Gagal membaca data Snack Video" isi={hasil.pesan} />;
}

function Pesan({ judul, isi }: { judul: string; isi: string }) {
  return (
    <>
      <PageHead
        title="Snack Video"
        subtitle="Laporan spend bulanan dari database operasional"
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
