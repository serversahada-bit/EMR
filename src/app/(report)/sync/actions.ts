"use server";

import { SyncInput } from "@/data/sheet-sync/row-schema";
import { syncSheet, type RingkasanSync } from "@/data/sheet-sync/sync";

export type HasilAksi =
  | { status: "awal" }
  | { status: "ok"; ringkasan: RingkasanSync }
  | { status: "galat"; pesan: string };

/**
 * Kesalahan yang bisa diperkirakan dikembalikan sebagai nilai, bukan
 * dilempar: sheet yang belum dibagikan atau tab salah ketik adalah
 * kejadian sehari-hari, dan pengguna butuh membacanya di form — bukan
 * mendapat layar error.
 */
export async function jalankanSync(
  _sebelumnya: HasilAksi,
  formData: FormData,
): Promise<HasilAksi> {
  const masukan = SyncInput.safeParse({
    sheetUrl: String(formData.get("sheetUrl") ?? "").trim(),
    tabName: String(formData.get("tabName") ?? "").trim(),
    operator: String(formData.get("operator") ?? "").trim(),
  });

  if (!masukan.success) {
    return {
      status: "galat",
      pesan: masukan.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    return { status: "ok", ringkasan: await syncSheet(masukan.data) };
  } catch (galat) {
    return {
      status: "galat",
      pesan: galat instanceof Error ? galat.message : "Sync gagal.",
    };
  }
}
