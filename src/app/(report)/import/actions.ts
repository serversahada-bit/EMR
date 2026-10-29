"use server";

import { revalidatePath } from "next/cache";

import { jalankanImpor, type HasilImpor } from "@/data/impor-progres";
import { wajibLogin } from "@/lib/sesi";

export type HasilAksi =
  | { status: "awal" }
  | { status: "ok"; mode: "pratinjau" | "simpan"; links: string[]; data: HasilImpor }
  | { status: "galat"; pesan: string };

/* Dua bentuk yang dipakai selama ini: link editor Sheets, dan link
   "Salin link" dari Drive (drive.google.com/open?id=...). */
const POLA_LINK =
  /^https:\/\/(docs\.google\.com\/spreadsheets\/d\/|drive\.google\.com\/open\?id=)[a-zA-Z0-9_-]+/;
const MAKS_LINK = 10;

/**
 * Pratinjau dan simpan lewat satu aksi; tombol yang ditekan menentukan
 * `mode`. Skrip mengunduh ulang sheet di kedua mode, jadi yang disimpan
 * adalah isi sheet saat tombol Simpan ditekan — pratinjau ulang setelah
 * simpan (`cek_ulang`) menunjukkan hasil akhirnya.
 */
export async function aksiImpor(
  _sebelumnya: HasilAksi,
  formData: FormData,
): Promise<HasilAksi> {
  /* Bisa dipanggil lewat POST langsung — sesi diperiksa di sini juga. */
  await wajibLogin();

  const mode = formData.get("mode") === "simpan" ? "simpan" : "pratinjau";
  const links = String(formData.get("links") ?? "")
    .split(/\s+/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (links.length === 0) {
    return { status: "galat", pesan: "Tempel minimal satu link Google Sheet." };
  }
  if (links.length > MAKS_LINK) {
    return { status: "galat", pesan: `Maksimal ${MAKS_LINK} link sekali impor.` };
  }
  const salah = links.filter((l) => !POLA_LINK.test(l));
  if (salah.length > 0) {
    return {
      status: "galat",
      pesan: `Bukan link Google Sheet: ${salah.join(", ")}`,
    };
  }

  try {
    const data = await jalankanImpor(links, mode === "simpan");
    if (mode === "simpan") revalidatePath("/", "layout");
    return { status: "ok", mode, links, data };
  } catch (galat) {
    return {
      status: "galat",
      pesan: galat instanceof Error ? galat.message : "Impor gagal.",
    };
  }
}
