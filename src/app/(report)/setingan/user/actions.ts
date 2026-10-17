"use server";

import { revalidatePath } from "next/cache";

import {
  aturAktif,
  gantiPassword,
  hapusUser,
  jumlahUserAktif,
  tambahUser,
  userById,
} from "@/data/user-queries";
import { cocokPassword } from "@/lib/password";
import { pasangSesi, wajibLogin } from "@/lib/sesi";

/**
 * Pengelolaan akun login. Setiap aksi memeriksa sesinya sendiri karena
 * Server Action bisa dipanggil lewat POST langsung, dan setiap masukan
 * diperiksa ulang di sini, bukan hanya di form.
 *
 * Semua user yang login boleh mengelola user lain — belum ada peran.
 */
export type HasilUser = { ok: true; pesan?: string } | { ok: false; pesan: string };

const PANJANG_MIN = 8;

function cekPasswordBaru(pw: unknown): string | null {
  const s = String(pw ?? "");
  if (s.length < PANJANG_MIN) return `Password minimal ${PANJANG_MIN} karakter.`;
  if (s.length > 200) return "Password terlalu panjang.";
  if (s.toLowerCase() === "admin") return "Password itu terlalu mudah ditebak.";
  return null;
}

function perbarui(): void {
  revalidatePath("/setingan/user");
}

export async function aksiGantiPasswordSaya(
  lama: string,
  baru: string,
  ulang: string,
): Promise<HasilUser> {
  const saya = await wajibLogin();

  const salah = cekPasswordBaru(baru);
  if (salah) return { ok: false, pesan: salah };
  if (String(baru) !== String(ulang)) {
    return { ok: false, pesan: "Ulangi password baru dengan sama persis." };
  }

  const u = await userById(saya.id);
  if (!u || !(await cocokPassword(String(lama ?? ""), u.passwordHash))) {
    return { ok: false, pesan: "Password lama salah." };
  }

  const hash = await gantiPassword(u.id, String(baru), false);
  /* Password berubah → versi sesi berubah → cookie lama ditolak. Pasang
     cookie baru supaya user ini tidak ikut terlempar ke halaman login;
     sesi di perangkat lain tetap keluar, dan memang itu tujuannya. */
  await pasangSesi({ id: u.id, username: u.username, passwordHash: hash });
  perbarui();
  return { ok: true, pesan: "Password berhasil diganti." };
}

export async function aksiTambahUser(
  username: string,
  nama: string,
  password: string,
): Promise<HasilUser> {
  await wajibLogin();

  const un = String(username ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,60}$/.test(un)) {
    return {
      ok: false,
      pesan: "Username 3–60 karakter: huruf kecil, angka, titik, garis bawah, atau strip.",
    };
  }
  const salah = cekPasswordBaru(password);
  if (salah) return { ok: false, pesan: salah };

  try {
    await tambahUser(un, String(nama ?? "").trim().slice(0, 120), String(password));
  } catch (galat) {
    const pesan = galat instanceof Error ? galat.message : String(galat);
    if (pesan.includes("ER_DUP_ENTRY") || pesan.includes("Duplicate entry")) {
      return { ok: false, pesan: "Username itu sudah dipakai." };
    }
    return { ok: false, pesan };
  }
  perbarui();
  return { ok: true, pesan: `User ${un} ditambahkan. Ia diminta mengganti password saat login pertama.` };
}

export async function aksiResetPassword(id: number, password: string): Promise<HasilUser> {
  const saya = await wajibLogin();
  if (Number(id) === saya.id) {
    return { ok: false, pesan: "Untuk akun sendiri, pakai form Ganti password saya." };
  }
  const salah = cekPasswordBaru(password);
  if (salah) return { ok: false, pesan: salah };

  const u = await userById(Number(id));
  if (!u) return { ok: false, pesan: "User tidak ditemukan." };
  await gantiPassword(u.id, String(password), true);
  perbarui();
  return { ok: true, pesan: `Password ${u.username} direset. Ia diminta menggantinya saat login.` };
}

export async function aksiAturAktif(id: number, aktif: boolean): Promise<HasilUser> {
  const saya = await wajibLogin();
  if (Number(id) === saya.id) {
    return { ok: false, pesan: "Akun sendiri tidak bisa dinonaktifkan." };
  }
  if (!aktif && (await jumlahUserAktif(Number(id))) === 0) {
    return { ok: false, pesan: "Harus tersisa minimal satu user aktif." };
  }
  await aturAktif(Number(id), Boolean(aktif));
  perbarui();
  return { ok: true };
}

export async function aksiHapusUser(id: number): Promise<HasilUser> {
  const saya = await wajibLogin();
  if (Number(id) === saya.id) {
    return { ok: false, pesan: "Akun sendiri tidak bisa dihapus." };
  }
  if ((await jumlahUserAktif(Number(id))) === 0) {
    return { ok: false, pesan: "Harus tersisa minimal satu user aktif." };
  }
  await hapusUser(Number(id));
  perbarui();
  return { ok: true };
}
