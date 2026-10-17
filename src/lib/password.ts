import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Hash password dengan scrypt bawaan Node — tanpa dependensi baru.
 *
 * Format tersimpan: `scrypt$N$r$p$salt$hash` (base64). Parameternya ikut
 * disimpan supaya bisa dinaikkan kelak tanpa membuat hash lama tak
 * terbaca.
 */

const N = 16384;
const R = 8;
const P = 1;
const PANJANG = 32;

function turunkan(
  password: string,
  salt: Buffer,
  panjang: number,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((selesai, gagal) =>
    scrypt(password, salt, panjang, { N: n, r, p }, (galat, hasil) =>
      galat ? gagal(galat) : selesai(hasil),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await turunkan(password, salt, PANJANG, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function cocokPassword(password: string, tersimpan: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = tersimpan.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const harap = Buffer.from(hash, "base64");
  const hasil = await turunkan(
    password,
    Buffer.from(salt, "base64"),
    harap.length,
    Number(n),
    Number(r),
    Number(p),
  );
  return hasil.length === harap.length && timingSafeEqual(hasil, harap);
}
