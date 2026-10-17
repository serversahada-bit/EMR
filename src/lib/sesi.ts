import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { userById, type UserLogin } from "@/data/user-queries";

import { bacaToken, buatToken, NAMA_COOKIE, UMUR_SESI_DETIK, versiSesi } from "./auth";

/**
 * Pemeriksaan sesi lengkap — tanda tangan cookie DAN tabel `emr_user`.
 *
 * proxy.ts hanya memeriksa tanda tangan (tanpa database, karena ia
 * berjalan di setiap permintaan). Di sini dipastikan user masih ada,
 * masih aktif, dan passwordnya belum diganti sejak cookie dibuat.
 * Dipanggil layout laporan dan setiap Server Action — Server Action bisa
 * dipanggil langsung seperti endpoint publik.
 */

export interface Pengguna {
  id: number;
  username: string;
  nama: string | null;
  harusGanti: boolean;
}

export async function penggunaAktif(): Promise<Pengguna | null> {
  const isi = bacaToken((await cookies()).get(NAMA_COOKIE)?.value);
  if (!isi) return null;
  const u = await userById(isi.uid);
  if (!u || !u.aktif || versiSesi(u.passwordHash) !== isi.v) return null;
  return { id: u.id, username: u.username, nama: u.nama, harusGanti: u.harusGanti };
}

export async function wajibLogin(): Promise<Pengguna> {
  const p = await penggunaAktif();
  if (!p) redirect("/login");
  return p;
}

/** Pasang cookie sesi untuk user ini (dipakai saat login dan ganti password). */
export async function pasangSesi(u: Pick<UserLogin, "id" | "username" | "passwordHash">) {
  /* `secure` hanya bila diakses lewat HTTPS. Kalau dipaksa, server yang
     masih http (mis. baru dipasang di Coolify tanpa domain) tidak akan
     pernah menerima cookie-nya dan login berputar terus. */
  const h = await headers();
  const https = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";

  (await cookies()).set(
    NAMA_COOKIE,
    buatToken({ uid: u.id, u: u.username, v: versiSesi(u.passwordHash) }),
    { httpOnly: true, secure: https, sameSite: "lax", path: "/", maxAge: UMUR_SESI_DETIK },
  );
}

export async function hapusSesi(): Promise<void> {
  (await cookies()).delete(NAMA_COOKIE);
}
