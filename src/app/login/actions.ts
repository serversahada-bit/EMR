"use server";

import { redirect } from "next/navigation";

import { catatLogin, userUntukLogin } from "@/data/user-queries";
import { cocokPassword, hashPassword } from "@/lib/password";
import { hapusSesi, pasangSesi } from "@/lib/sesi";

export type HasilLogin = { pesan: string } | undefined;

/** Hanya jalur di dalam situs ini — mencegah ?next=https://situs-lain. */
function tujuanAman(next: FormDataEntryValue | null): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

/* Hash pembanding untuk username yang tidak ada: tetap dihitung supaya
   lamanya respons tidak membocorkan username mana yang terdaftar. */
let hashPalsu: Promise<string> | null = null;

export async function login(_: HasilLogin, form: FormData): Promise<HasilLogin> {
  const username = String(form.get("user") ?? "").trim();
  const password = String(form.get("password") ?? "");

  const u = await userUntukLogin(username);
  hashPalsu ??= hashPassword("tidak-dipakai");
  const cocok = await cocokPassword(password, u?.passwordHash ?? (await hashPalsu));

  if (!u || !cocok || !u.aktif) {
    /* Jeda kecil memperlambat tebak-tebakan password beruntun. Pesan
       sengaja sama untuk user salah, password salah, dan akun nonaktif. */
    await new Promise((r) => setTimeout(r, 500));
    return { pesan: "User atau password salah." };
  }

  await catatLogin(u.id);
  await pasangSesi(u);

  redirect(u.harusGanti ? "/setingan/user?ganti=1" : tujuanAman(form.get("next")));
}

export async function logout(): Promise<void> {
  await hapusSesi();
  redirect("/login");
}
