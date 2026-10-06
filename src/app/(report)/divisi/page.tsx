"use client";

import { BarChart } from "@/components/BarChart";
import { Card, CardHead } from "@/components/Card";
import { ChartFrame } from "@/components/ChartFrame";
import { DataTable } from "@/components/DataTable";
import { PageHead } from "@/components/PageHead";
import { divisionColumns } from "@/components/columns";
import { formatIDR } from "@/lib/format";
import { useReport } from "@/lib/report-context";

export default function DivisiPage() {
  const { matchedDivisions, scopeLabel, periodChip } = useReport();

  return (
    <>
      <PageHead title="Unit bisnis" subtitle="Kontribusi dan kinerja tiap divisi" />

      <div className="grid gap-4 lg:grid-cols-12">
        {matchedDivisions.length > 1 ? (
          <ChartFrame
            className="lg:col-span-12"
            title="Kontribusi omset per divisi"
            subtitle="Beralih ke tabel untuk target, pencapaian, dan marjin"
            chip={periodChip}
            chart={
              <BarChart
                rows={matchedDivisions.map((row) => ({
                  id: row.divisionId,
                  label: row.name,
                  value: row.revenue,
                }))}
                formatValue={(v) => formatIDR(v)}
                labelWidth={168}
              />
            }
            table={
              <DataTable
                rows={matchedDivisions}
                rowKey={(row) => row.divisionId}
                columns={divisionColumns}
              />
            }
          />
        ) : (
          <Card className="lg:col-span-12">
            <CardHead
              title="Rincian unit bisnis"
              subtitle={scopeLabel}
              actions={periodChip}
            />
            <div className="px-5 pb-5">
              <DataTable
                rows={matchedDivisions}
                rowKey={(row) => row.divisionId}
                columns={divisionColumns}
              />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
