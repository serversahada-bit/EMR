import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Token sesi — cookie berisi id user, nama user, versi sesi, dan waktu
 * kedaluwarsa, ditandatangani HMAC-SHA256.
 *
 * Modul ini dipakai proxy.ts, jadi tidak boleh mengimpor "server-only"
 * atau modul database: proxy hanya memeriksa tanda tangan. Pemeriksaan
 * ke tabel `emr_user` (user masih aktif, password belum diganti)
 * dilakukan di `src/lib/sesi.ts`.
 *
 * VERSI SESI = potongan hash dari password_hash. Begitu password
 * diganti, versinya berubah dan semua cookie lama ditolak di sesi.ts —
 * tanpa perlu tabel sesi.
 */

export const NAMA_COOKIE = "emr_sesi";
export const UMUR_SESI_DETIK = 7 * 24 * 60 * 60;

export interface IsiSesi {
  uid: number;
  u: string;
  v: string;
}

/**
 * Kunci tanda tangan: env AUTH_SECRET, atau berkas `.emr-secret` yang
 * dibuat acak sekali lalu dipakai terus.
 *
 * Bukan kunci acak di memori: proxy dan halaman bisa memuat modul ini
 * di instans terpisah, dan kunci yang berbeda membuat setiap cookie
 * ditolak. Berkas dibaca semua instans, jadi kuncinya sama. Di server
 * yang berkasnya hilang tiap deploy (container), isi AUTH_SECRET supaya
 * user tidak perlu login ulang setiap deploy.
 */
let kunciCache: string | null = null;

function kunci(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (kunciCache) return kunciCache;
  const berkas = path.join(process.cwd(), ".emr-secret");
  try {
    kunciCache = readFileSync(berkas, "utf8").trim();
  } catch {
    const baru = randomBytes(32).toString("base64url");
    try {
      /* "wx" gagal bila berkas sudah ada — instans lain yang sempat
         menulis duluan menang, dan kuncinya yang dipakai. */
      writeFileSync(berkas, baru, { flag: "wx" });
      kunciCache = baru;
    } catch {
      kunciCache = readFileSync(berkas, "utf8").trim();
    }
  }
  return kunciCache;
}

function tandaTangan(isi: string): string {
  return createHmac("sha256", kunci()).update(isi).digest("base64url");
}

function sama(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function versiSesi(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

export function buatToken(isi: IsiSesi): string {
  const badan = Buffer.from(
    JSON.stringify({ ...isi, exp: Math.floor(Date.now() / 1000) + UMUR_SESI_DETIK }),
  ).toString("base64url");
  return `${badan}.${tandaTangan(badan)}`;
}

/** Isi token bila tanda tangannya sah dan belum kedaluwarsa, selain itu null. */
export function bacaToken(token: string | undefined): IsiSesi | null {
  if (!token) return null;
  const [badan, ttd] = token.split(".");
  if (!badan || !ttd || !sama(ttd, tandaTangan(badan))) return null;
  try {
    const { uid, u, v, exp } = JSON.parse(Buffer.from(badan, "base64url").toString("utf8"));
    if (typeof uid !== "number" || typeof u !== "string" || typeof v !== "string") return null;
    if (typeof exp !== "number" || exp < Date.now() / 1000) return null;
    return { uid, u, v };
  } catch {
    return null;
  }
}
