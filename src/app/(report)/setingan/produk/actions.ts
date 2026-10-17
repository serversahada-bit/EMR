"use server";

import { revalidatePath } from "next/cache";

import {
  hapusProduk,
  petakanSumber,
  tambahProduk,
  ubahGambarProduk,
  ubahProduk,
  type Platform,
} from "@/data/produk-queries";
import { wajibLogin } from "@/lib/sesi";

/**
 * Kesalahan yang bisa diperkirakan — nama kosong, nama kembar, gambar
 * kebesaran — dikembalikan sebagai nilai, bukan dilempar: semuanya
 * kejadian sehari-hari yang perlu dibaca di form, bukan layar error.
 */
export type HasilSetingan = { ok: true } | { ok: false; pesan: string };

/* Server Action bisa dipanggil lewat POST langsung, bukan hanya dari
   tombol di halaman ini, jadi tiap masukan diperiksa ulang di sini. */
function bacaNama(nama: unknown): string | null {
  const bersih = String(nama ?? "").trim();
  if (bersih.length === 0 || bersih.length > 120) return null;
  return bersih;
}

function bacaPlatform(nilai: unknown): Platform | null {
  return nilai === "meta" || nilai === "google" ? nilai : null;
}

function perbarui(): void {
  /* Ketiga halaman membaca pemetaan yang sama. */
  revalidatePath("/setingan/produk");
  revalidatePath("/meta/spend-iklan");
  revalidatePath("/google/spend-iklan");
}

function pesanGalat(galat: unknown): string {
  const pesan = galat instanceof Error ? galat.message : String(galat);
  /* Nama produk unik di database; pesan MySQL-nya tidak terbaca awam. */
  if (pesan.includes("ER_DUP_ENTRY") || pesan.includes("Duplicate entry")) {
    return "Nama produk itu sudah ada.";
  }
  return pesan;
}

export async function aksiTambahProduk(
  nama: string,
  kode: string,
): Promise<HasilSetingan> {
  /* Bisa dipanggil lewat POST langsung — sesi diperiksa di sini juga. */
  await wajibLogin();

  const bersih = bacaNama(nama);
  if (!bersih) return { ok: false, pesan: "Nama produk tidak boleh kosong." };

  try {
    await tambahProduk(bersih, String(kode ?? "").trim().slice(0, 40));
    perbarui();
    return { ok: true };
  } catch (galat) {
    return { ok: false, pesan: pesanGalat(galat) };
  }
}

export async function aksiUbahProduk(
  id: number,
  nama: string,
  kode: string,
): Promise<HasilSetingan> {
  await wajibLogin();
  const bersih = bacaNama(nama);
  if (!bersih) return { ok: false, pesan: "Nama produk tidak boleh kosong." };

  try {
    await ubahProduk(
      Number(id),
      bersih,
      String(kode ?? "").trim().slice(0, 40),
    );
    perbarui();
    return { ok: true };
  } catch (galat) {
    return { ok: false, pesan: pesanGalat(galat) };
  }
}

/** `gambar === null` menghapus gambar yang tersimpan. */
export async function aksiUbahGambar(
  id: number,
  gambar: string | null,
): Promise<HasilSetingan> {
  await wajibLogin();
  try {
    await ubahGambarProduk(Number(id), gambar);
    perbarui();
    return { ok: true };
  } catch (galat) {
    return { ok: false, pesan: pesanGalat(galat) };
  }
}

export async function aksiHapusProduk(id: number): Promise<HasilSetingan> {
  await wajibLogin();
  try {
    await hapusProduk(Number(id));
    perbarui();
    return { ok: true };
  } catch (galat) {
    return { ok: false, pesan: pesanGalat(galat) };
  }
}

export async function aksiPetakanSumber(
  platform: string,
  sumberId: string,
  idProduk: number | null,
): Promise<HasilSetingan> {
  await wajibLogin();
  const p = bacaPlatform(platform);
  if (!p) return { ok: false, pesan: "Platform tidak dikenal." };

  const sumber = String(sumberId ?? "").trim();
  if (!sumber || sumber.length > 120) {
    return { ok: false, pesan: "Sumber tidak dikenal." };
  }

  try {
    await petakanSumber(p, sumber, idProduk === null ? null : Number(idProduk));
    perbarui();
    return { ok: true };
  } catch (galat) {
    return { ok: false, pesan: pesanGalat(galat) };
  }
}
