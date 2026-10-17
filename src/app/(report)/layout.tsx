import type { ReactNode } from "react";

import { wajibLogin } from "@/lib/sesi";

import { ReportShell } from "./ReportShell";

/**
 * Penjaga login untuk semua halaman laporan.
 *
 * proxy.ts sudah menolak cookie yang tanda tangannya tidak sah; di sini
 * diperiksa ke tabel `emr_user` bahwa user masih ada, masih aktif, dan
 * passwordnya belum diganti. Layout tidak dirender ulang saat berpindah
 * halaman di sisi klien, jadi user yang dinonaktifkan baru terkunci pada
 * muat-ulang berikutnya — Server Action tetap memeriksa setiap kali.
 */
export default async function ReportLayout({ children }: { children: ReactNode }) {
  const p = await wajibLogin();
  return (
    <ReportShell pengguna={{ username: p.username, nama: p.nama, harusGanti: p.harusGanti }}>{children}</ReportShell>
  );
}
