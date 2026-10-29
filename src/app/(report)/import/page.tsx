import { riwayatImpor, skripSiap, targetDb } from "@/data/impor-progres";

import { ImportView } from "./ImportView";

export const metadata = { title: "Import Progres — PT SLU" };

/* Impor menulis ke database, jadi halamannya tidak boleh diprarender
   atau di-cache seperti halaman laporan lain. */
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  return (
    <ImportView
      db={targetDb()}
      skripSiap={skripSiap()}
      riwayat={await riwayatImpor()}
    />
  );
}
