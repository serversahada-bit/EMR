import { TABEL } from "@/data/sheet-sync/sync";

import { SyncView } from "./SyncView";

export const metadata = { title: "Sync Google Sheet — PT SLU" };

/* Sync menulis ke database, jadi halamannya tidak boleh diprarender
   atau di-cache seperti halaman laporan lain. */
export const dynamic = "force-dynamic";

export default function SyncPage() {
  return <SyncView tabelTujuan={TABEL.transaksi} />;
}
