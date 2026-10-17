import "server-only";

import { hashPassword } from "@/lib/password";

import { query } from "./db";

/**
 * Akun login laporan — tabel `emr_user`.
 *
 * Seperti `emr_produk`, tabelnya dibuat sendiri saat pertama dipakai dan
 * berawalan `emr_` supaya tidak bercampur dengan tabel aplikasi PHP.
 * Password disimpan sebagai hash scrypt (lihat src/lib/password.ts),
 * tidak pernah sebagai teks.
 *
 * Isi awal satu akun admin / admin bertanda `harus_ganti`: login pertama
 * langsung diarahkan ke halaman ganti password.
 */

const TABEL = "emr_user";

export interface UserEmr {
  id: number;
  username: string;
  nama: string | null;
  aktif: boolean;
  harusGanti: boolean;
  loginTerakhir: string | null;
  dibuat: string;
}

export interface UserLogin {
  id: number;
  username: string;
  nama: string | null;
  passwordHash: string;
  aktif: boolean;
  harusGanti: boolean;
}

let skema: Promise<void> | null = null;

export function pastikanSkemaUser(): Promise<void> {
  /* Bila gagal (mis. database mati), jangan simpan promise yang gagal —
     permintaan berikutnya harus mencoba lagi. */
  skema ??= buatSkema().catch((galat) => {
    skema = null;
    throw galat;
  });
  return skema;
}

async function buatSkema(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS \`${TABEL}\` (
       id INT NOT NULL AUTO_INCREMENT,
       username VARCHAR(60) NOT NULL,
       nama VARCHAR(120) DEFAULT NULL,
       password_hash VARCHAR(255) NOT NULL,
       aktif TINYINT(1) NOT NULL DEFAULT 1,
       harus_ganti TINYINT(1) NOT NULL DEFAULT 0,
       login_terakhir DATETIME DEFAULT NULL,
       dibuat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uniq_username (username)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  const [jumlah] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM \`${TABEL}\``);
  if (Number(jumlah?.n ?? 0) > 0) return;

  /* INSERT IGNORE: dua proses yang hidup bersamaan tidak akan membuat
     admin ganda atau saling gagal. */
  await query(
    `INSERT IGNORE INTO \`${TABEL}\` (username, nama, password_hash, harus_ganti)
     VALUES ('admin', 'Administrator', ?, 1)`,
    [await hashPassword("admin")],
  );
}

type Baris = {
  id: number;
  username: string;
  nama: string | null;
  password_hash: string;
  aktif: number;
  harus_ganti: number;
};

function keLogin(r: Baris | undefined): UserLogin | null {
  if (!r) return null;
  return {
    id: Number(r.id),
    username: r.username,
    nama: r.nama,
    passwordHash: r.password_hash,
    aktif: Number(r.aktif) === 1,
    harusGanti: Number(r.harus_ganti) === 1,
  };
}

export async function userUntukLogin(username: string): Promise<UserLogin | null> {
  await pastikanSkemaUser();
  const [r] = await query<Baris>(
    `SELECT id, username, nama, password_hash, aktif, harus_ganti
       FROM \`${TABEL}\` WHERE username = ?`,
    [username],
  );
  return keLogin(r);
}

export async function userById(id: number): Promise<UserLogin | null> {
  await pastikanSkemaUser();
  const [r] = await query<Baris>(
    `SELECT id, username, nama, password_hash, aktif, harus_ganti
       FROM \`${TABEL}\` WHERE id = ?`,
    [id],
  );
  return keLogin(r);
}

export async function daftarUser(): Promise<UserEmr[]> {
  await pastikanSkemaUser();
  const rows = await query<{
    id: number;
    username: string;
    nama: string | null;
    aktif: number;
    harus_ganti: number;
    login_terakhir: string | null;
    dibuat: string;
  }>(
    `SELECT id, username, nama, aktif, harus_ganti, login_terakhir, dibuat
       FROM \`${TABEL}\` ORDER BY username`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    username: r.username,
    nama: r.nama,
    aktif: Number(r.aktif) === 1,
    harusGanti: Number(r.harus_ganti) === 1,
    loginTerakhir: r.login_terakhir,
    dibuat: r.dibuat,
  }));
}

export async function tambahUser(
  username: string,
  nama: string,
  password: string,
): Promise<void> {
  await pastikanSkemaUser();
  await query(
    `INSERT INTO \`${TABEL}\` (username, nama, password_hash, harus_ganti)
     VALUES (?, ?, ?, 1)`,
    [username, nama || null, await hashPassword(password)],
  );
}

/** `harusGanti` true dipakai saat admin mereset password orang lain. */
export async function gantiPassword(
  id: number,
  password: string,
  harusGanti: boolean,
): Promise<string> {
  await pastikanSkemaUser();
  const hash = await hashPassword(password);
  await query(
    `UPDATE \`${TABEL}\` SET password_hash = ?, harus_ganti = ? WHERE id = ?`,
    [hash, harusGanti ? 1 : 0, id],
  );
  return hash;
}

export async function aturAktif(id: number, aktif: boolean): Promise<void> {
  await pastikanSkemaUser();
  await query(`UPDATE \`${TABEL}\` SET aktif = ? WHERE id = ?`, [aktif ? 1 : 0, id]);
}

export async function hapusUser(id: number): Promise<void> {
  await pastikanSkemaUser();
  await query(`DELETE FROM \`${TABEL}\` WHERE id = ?`, [id]);
}

export async function jumlahUserAktif(kecualiId?: number): Promise<number> {
  await pastikanSkemaUser();
  const [r] = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM \`${TABEL}\` WHERE aktif = 1 AND id <> ?`,
    [kecualiId ?? 0],
  );
  return Number(r?.n ?? 0);
}

export async function catatLogin(id: number): Promise<void> {
  await query(`UPDATE \`${TABEL}\` SET login_terakhir = NOW() WHERE id = ?`, [id]);
}
