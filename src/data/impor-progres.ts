import "server-only";

import { execFile } from "node:child_process";
import path from "node:path";

import { query } from "./db";

/* ──────────────────────────────────────────────────────────────
   Import file Progres dari link Google Sheet.

   Pengurainya TIDAK ditulis ulang di sini: halaman ini memanggil
   `impor_progres.py` — skrip yang sama yang selama ini dipakai dari
   terminal — dengan `--json`. Semua kuirk file Progres (banner produk,
   blok tanggal ganda, sheet beku, baris hantu MP, dsb.) sudah ditangani
   di sana dan sudah diuji ke isi DB, jadi satu pengurai untuk dua jalur.

   Lokasi skrip diatur lewat .env.local:
     IMPOR_PROGRES_DIR = folder yang berisi impor_progres.py
     IMPOR_PYTHON      = perintah python (bawaan: "python")

   Koneksi DB diteruskan lewat variabel lingkungan (`--env-proses`),
   memakai nilai bawaan yang sama dengan db.ts — sehingga impor selalu
   menulis ke database yang sama dengan yang dibaca laporan EMR.
   ────────────────────────────────────────────────────────────── */

export interface KanalImpor {
  kunci: string;
  tabel: string;
  ukuran: string;
  baris_link: number;
  total_link: number;
  baris_db: number;
  total_db: number;
  status: "sama" | "BARU" | "berubah" | "tetap (link kosong)";
}

export interface TabDipakai {
  tab: string;
  kanal: string;
  baris: number;
}

export interface HasilLink {
  link: string;
  galat?: string;
  judul?: string;
  produk?: string;
  bulan?: string;
  tahun?: number;
  kanal?: KanalImpor[];
  catatan?: string[];
  tab?: TabDipakai[];
  tersimpan?: boolean;
  kolom_tanpa_tempat?: Record<string, string[]>;
  /** Pratinjau ulang setelah simpan — semua kanal seharusnya "sama". */
  cek_ulang?: KanalImpor[];
}

export interface TargetDb {
  host: string;
  nama: string;
}

export interface HasilImpor {
  db: TargetDb;
  hasil: HasilLink[];
}

export interface RiwayatImpor {
  id: number;
  waktu: string;
  judul: string | null;
  link: string | null;
}

/* Unduh 8 MB + urai ratusan sheet bisa makan 1–2 menit per link. */
const BATAS_WAKTU_MS = 15 * 60 * 1000;

function envDb(): Record<string, string> {
  return {
    DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
    DB_PORT: process.env.DB_PORT ?? "3306",
    DB_USER: process.env.DB_USER ?? "root",
    DB_PASSWORD: process.env.DB_PASSWORD ?? "",
    DB_NAME: process.env.DB_NAME ?? "dataslu",
  };
}

/** Database tujuan impor — ditampilkan sebelum tombol Simpan ditekan. */
export function targetDb(): TargetDb {
  const e = envDb();
  return { host: e.DB_HOST, nama: e.DB_NAME };
}

export function skripSiap(): boolean {
  return Boolean(process.env.IMPOR_PROGRES_DIR);
}

export async function jalankanImpor(
  links: string[],
  simpan: boolean,
): Promise<HasilImpor> {
  const folder = process.env.IMPOR_PROGRES_DIR;
  if (!folder) {
    throw new Error(
      "IMPOR_PROGRES_DIR belum diisi di .env.local — isi dengan folder yang berisi impor_progres.py.",
    );
  }

  const argumen = [
    path.join(folder, "impor_progres.py"),
    ...links,
    "--env-proses",
    "--json",
    ...(simpan ? ["--simpan"] : []),
  ];

  /* COOLIFY_DB_* dibuang: skrip memprioritaskannya di atas DB_*, dan
     impor dari halaman ini harus menulis ke DB yang sama dengan EMR. */
  const env: NodeJS.ProcessEnv = { ...process.env, ...envDb(), PYTHONIOENCODING: "utf-8" };
  for (const k of Object.keys(env)) if (k.startsWith("COOLIFY_")) delete env[k];

  const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>(
    (resolve, reject) => {
      execFile(
        process.env.IMPOR_PYTHON ?? "python",
        argumen,
        {
          cwd: folder,
          env,
          timeout: BATAS_WAKTU_MS,
          maxBuffer: 64 * 1024 * 1024,
          windowsHide: true,
        },
        (galat, out, err) => {
          /* Skrip mode --json selalu menulis JSON, termasuk saat gagal
             per link — jadi exit code bukan nol berarti Python-nya sendiri
             yang gagal (tidak ditemukan, modul kurang, kehabisan waktu). */
          if (galat && !out) {
            const ekor = String(err).trim().split("\n").slice(-6).join("\n");
            reject(new Error(`${galat.message}${ekor ? `\n${ekor}` : ""}`));
          } else resolve({ stdout: String(out), stderr: String(err) });
        },
      );
    },
  );

  let data: { ok: boolean; pesan?: string } & Partial<HasilImpor>;
  try {
    data = JSON.parse(stdout);
  } catch {
    const ekor = stderr.trim().split("\n").slice(-6).join("\n");
    throw new Error(`Keluaran skrip bukan JSON.${ekor ? `\n${ekor}` : ""}`);
  }
  if (!data.ok || !data.db || !data.hasil) {
    throw new Error(data.pesan ?? "Skrip impor gagal tanpa pesan.");
  }
  return { db: data.db, hasil: data.hasil };
}

/** 15 impor terakhir dari `emr_import_log` (tabel dibuat saat simpan pertama). */
export async function riwayatImpor(): Promise<RiwayatImpor[]> {
  try {
    return await query<RiwayatImpor>(
      "SELECT id, waktu, judul, link FROM emr_import_log ORDER BY id DESC LIMIT 15",
    );
  } catch {
    return [];
  }
}
