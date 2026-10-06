"use client";

import { Card, CardHead } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Meter } from "@/components/Meter";
import { StatusPill } from "@/components/Pill";
import { PageHead } from "@/components/PageHead";
import { formatNumber } from "@/lib/format";
import { useReport } from "@/lib/report-context";

export default function InisiatifPage() {
  const { matchedInitiatives, periodChip } = useReport();

  return (
    <>
      <PageHead title="Inisiatif strategis" subtitle="Progres program prioritas terhadap rencana direksi" />

      <Card>
        <CardHead
          title="Status program prioritas"
          subtitle="Progres terhadap rencana yang disetujui direksi"
          actions={periodChip}
        />
        <div className="px-5 pb-5">
          {matchedInitiatives.length ? (
            <DataTable
              rows={matchedInitiatives}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "name",
                  header: "Inisiatif",
                  render: (row) => (
                    <div className="min-w-[220px]">
                      <p className="font-medium text-ink">{row.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {row.note}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "owner",
                  header: "Penanggung jawab",
                  render: (row) => (
                    <span className="whitespace-nowrap">{row.owner}</span>
                  ),
                },
                {
                  key: "progress",
                  header: "Progres",
                  render: (row) => (
                    <div className="w-32">
                      <Meter
                        ratio={row.progress}
                        valueLabel={formatNumber(row.progress) + "%"}
                      />
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <StatusPill status={row.status} />,
                },
                {
                  key: "due",
                  header: "Target selesai",
                  render: (row) => (
                    <span className="whitespace-nowrap">{row.due}</span>
                  ),
                },
              ]}
            />
          ) : (
            <p className="py-8 text-center text-xs text-muted">
              Tidak ada inisiatif yang cocok dengan filter saat ini.
            </p>
          )}
        </div>
      </Card>
    </>
  );
}
