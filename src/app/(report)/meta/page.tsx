import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { META_SOURCES, metaSourceMonths } from "@/data/meta-queries";
import { MetaView, type MetaReportData } from "./MetaView";

export const dynamic = "force-dynamic";

type Result =
  | { status: "ok"; data: MetaReportData }
  | { status: "empty" }
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
    const sourceMonths = await metaSourceMonths();
    if (sourceMonths.length === 0) return { status: "empty" };

    const bulanKini = bulanSaatIni();
    const pilihan = [...new Set([bulanKini, ...sourceMonths.map((row) => row.month)])].sort(
      (a, b) => b.localeCompare(a),
    );
    const bulan = requested && pilihan.includes(requested) ? requested : bulanKini;

    const totals = new Map<string, MetaReportData["monthly"][number]>();
    for (const row of sourceMonths) {
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
    if (!totals.has(bulanKini)) {
      totals.set(bulanKini, {
        month: bulanKini,
        spend: 0,
        records: 0,
        sources: 0,
        lastDate: "",
      });
    }

    const monthly = [...totals.values()].sort((a, b) => a.month.localeCompare(b.month));
    const bySource = META_SOURCES.map((source) => {
      const match = sourceMonths.find(
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

    return { status: "ok", data: { bulan, bulanKini, pilihan, monthly, bySource } };
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "Penyebab tidak diketahui.",
    };
  }
}

export default async function MetaPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const { bulan } = await searchParams;
  const result = await ambilData(bulan);

  if (result.status === "ok") return <MetaView data={result.data} />;
  if (result.status === "empty") {
    return <Message title="Belum ada data Meta Ads" detail="Ketujuh tabel spend belum memiliki tanggal yang valid." />;
  }
  return <Message title="Gagal membaca data Meta Ads" detail={result.detail} />;
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <>
      <PageHead title="Meta Ads" subtitle="Laporan spend bulanan dari database operasional" />
      <Card className="p-8">
        <p className="text-center text-sm font-semibold text-ink">{title}</p>
        <p className="mt-2 text-center text-xs text-ink-2">{detail}</p>
      </Card>
    </>
  );
}