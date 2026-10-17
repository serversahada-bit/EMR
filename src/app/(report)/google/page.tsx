import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { googleSourceMonths } from "@/data/google-queries";
import { GoogleView, type GoogleReportData } from "./GoogleView";

export const dynamic = "force-dynamic";

type Result =
  | { status: "ok"; data: GoogleReportData }
  /* Tabelnya ada tapi tidak memuat tanggal yang bisa dipakai. */
  | { status: "empty" }
  /* Belum ada satu pun tabel data_spend_google_* di database. */
  | { status: "belum-ada-tabel" }
  | { status: "error"; detail: string };

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

async function ambilData(requested?: string): Promise<Result> {
  try {
    const { sources, months } = await googleSourceMonths();
    if (sources.length === 0) return { status: "belum-ada-tabel" };
    if (months.length === 0) return { status: "empty" };

    const bulanKini = bulanSaatIni();
    const pilihan = [
      ...new Set([bulanKini, ...months.map((row) => row.month)]),
    ].sort((a, b) => b.localeCompare(a));
    const bulan =
      requested && pilihan.includes(requested) ? requested : bulanKini;

    const totals = new Map<string, GoogleReportData["monthly"][number]>();
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
      const match = months.find(
        (row) => row.month === bulan && row.sourceId === source.id,
      );
      return {
        id: source.id,
        label: source.label,
        table: source.table,
        spend: match?.spend ?? 0,
        records: match?.records ?? 0,
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
      status: "error",
      detail:
        error instanceof Error ? error.message : "Penyebab tidak diketahui.",
    };
  }
}

export default async function GooglePage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const { bulan } = await searchParams;
  const result = await ambilData(bulan);

  if (result.status === "ok") return <GoogleView data={result.data} />;

  if (result.status === "belum-ada-tabel") {
    return (
      <Message
        title="Belum ada tabel spend Google"
        detail={
          "Database belum memuat tabel bernama data_spend_google… — " +
          "berbeda dari Meta yang sudah punya sembilan tabel harian. " +
          "Halaman ini akan langsung terisi begitu tabelnya dibuat, " +
          "tanpa perlu mengubah kode: sumbernya dibaca dari katalog database."
        }
      />
    );
  }

  if (result.status === "empty") {
    return (
      <Message
        title="Belum ada data Google Ads"
        detail="Tabel spend Google sudah ada tetapi belum memuat baris dengan tanggal yang valid."
      />
    );
  }

  return <Message title="Gagal membaca data Google Ads" detail={result.detail} />;
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <>
      <PageHead
        title="Google Ads"
        subtitle="Laporan spend bulanan dari database operasional"
      />
      <Card className="p-8">
        <p className="text-center text-sm font-semibold text-ink">{title}</p>
        <p className="mx-auto mt-2 max-w-xl text-center text-xs leading-relaxed text-ink-2">
          {detail}
        </p>
      </Card>
    </>
  );
}
