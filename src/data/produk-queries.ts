import "server-only";

import { query } from "./db";

/**
 * Setingan produk: nama tampilan, gambar kecil, dan pemetaan tabel
 * spend iklan ke produknya.
 *
 * Tabelnya dibuat sendiri dengan awalan `emr_` dan TIDAK menyentuh
 * `data_produk` milik aplikasi PHP: tabel itu masih ditulis sistem lain,
 * jadi menambah kolom di sana berisiko. `data_produk` hanya dibaca satu
 * kali, sebagai isi awal.
 *
 * Gambar disimpan sebagai data URL di kolom teks, bukan sebagai berkas
 * di `public/`. Alasannya: dashboard ini dijalankan dari beberapa mesin
 * sekaligus (lokal dan server), dan berkas yang ditulis saat runtime
 * tidak ikut berpindah — baris database ikut. Ukurannya tetap kecil
 * karena gambar diperkecil di browser sebelum dikirim.
 */

const TABEL_PRODUK = "emr_produk";
const TABEL_PEMETAAN = "emr_sumber_produk";

export type Platform = "meta" | "google" | "snack" | "mp";

export interface Produk {
  id: number;
  nama: string;
  kode: string | null;
  /** Data URL gambar kecil, atau null bila belum diunggah. */
  gambar: string | null;
  urutan: number;
}

/**
 * Pembuatan skema dijalankan sekali per proses.
 *
 * Disimpan sebagai promise, bukan boolean: dua permintaan yang datang
 * bersamaan saat proses baru hidup akan menunggu promise yang sama,
 * bukan menjalankan CREATE TABLE dua kali.
 */
let skema: Promise<void> | null = null;

export function pastikanSkemaProduk(): Promise<void> {
  skema ??= buatSkema();
  return skema;
}

async function buatSkema(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS \`${TABEL_PRODUK}\` (
       id INT NOT NULL AUTO_INCREMENT,
       nama VARCHAR(120) NOT NULL,
       kode VARCHAR(40) DEFAULT NULL,
       gambar MEDIUMTEXT DEFAULT NULL,
       urutan INT NOT NULL DEFAULT 0,
       PRIMARY KEY (id),
       UNIQUE KEY uniq_nama (nama)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await query(
    `CREATE TABLE IF NOT EXISTS \`${TABEL_PEMETAAN}\` (
       platform VARCHAR(16) NOT NULL,
       sumber_id VARCHAR(120) NOT NULL,
       id_produk INT NOT NULL,
       PRIMARY KEY (platform, sumber_id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await isiAwal();
}

/** "GAMAMILK PREMIUM" → "Gamamilk Premium" */
function rapikanNama(nama: string): string {
  return nama
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((kata) => kata.charAt(0).toUpperCase() + kata.slice(1))
    .join(" ");
}

/**
 * Tujuh produk yang dijual; urutannya ikut urutan ini di semua halaman.
 *
 * `data_produk` milik aplikasi PHP hanya memuat lima di antaranya —
 * Plus dan Sereal belum pernah didaftarkan di sana walau tabel
 * spend-nya sudah ada — jadi daftar ini yang jadi acuan, dan nama dari
 * `data_produk` hanya menambah bila ada yang belum tercantum.
 */
const PRODUK_BAKU = [
  { nama: "Gamamilk", kode: "GML" },
  { nama: "Gamamilk Premium", kode: "GP" },
  { nama: "Gamamilk Plus", kode: "" },
  { nama: "Gamamilk Sereal", kode: "" },
  { nama: "Etacefit", kode: "ETF" },
  { nama: "Phenobody", kode: "PB" },
  { nama: "Gnait", kode: "G" },
];

/**
 * Isi awal — hanya saat tabel masih kosong, supaya produk yang dihapus
 * pengguna tidak hidup lagi tiap proses dijalankan ulang.
 */
async function isiAwal(): Promise<void> {
  const [jumlah] = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM \`${TABEL_PRODUK}\``,
  );
  if (Number(jumlah?.n ?? 0) > 0) return;

  const sumber = await query<{ nama_produk: string; kode_produk: string }>(
    `SELECT nama_produk, kode_produk
     FROM data_produk
     WHERE nama_produk IS NOT NULL AND nama_produk <> ''
     ORDER BY nama_produk`,
  ).catch(() => []);

  /* Baris sampah di data_produk — nama berupa angka atau tanda hubung —
     tidak ikut: itu bukan produk. */
  const tambahan = sumber
    .filter((r) => /[a-z]/i.test(String(r.nama_produk)))
    .map((r) => ({
      nama: rapikanNama(String(r.nama_produk)),
      kode: r.kode_produk ? String(r.kode_produk) : "",
    }))
    .filter(
      (r) => !PRODUK_BAKU.some((b) => b.nama.toLowerCase() === r.nama.toLowerCase()),
    );

  for (const [urut, row] of [...PRODUK_BAKU, ...tambahan].entries()) {
    await query(
      `INSERT IGNORE INTO \`${TABEL_PRODUK}\` (nama, kode, urutan)
       VALUES (?, ?, ?)`,
      [row.nama, row.kode, urut * 10],
    );
  }
}

export async function daftarProduk(): Promise<Produk[]> {
  await pastikanSkemaProduk();

  const rows = await query<Record<string, unknown>>(
    `SELECT id, nama, kode, gambar, urutan
     FROM \`${TABEL_PRODUK}\`
     ORDER BY urutan, nama`,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    nama: String(row.nama),
    kode: row.kode ? String(row.kode) : null,
    gambar: row.gambar ? String(row.gambar) : null,
    urutan: Number(row.urutan ?? 0),
  }));
}

export interface PemetaanSumber {
  platform: Platform;
  sumberId: string;
  idProduk: number;
}

export async function daftarPemetaan(): Promise<PemetaanSumber[]> {
  await pastikanSkemaProduk();

  const rows = await query<Record<string, unknown>>(
    `SELECT platform, sumber_id, id_produk FROM \`${TABEL_PEMETAAN}\``,
  );

  return rows.map((row) => ({
    platform: String(row.platform) as Platform,
    sumberId: String(row.sumber_id),
    idProduk: Number(row.id_produk),
  }));
}

/**
 * Tebakan produk dari nama tabel, dipakai hanya saat sumbernya belum
 * dipetakan di halaman setingan.
 *
 * Tebakan sengaja tidak ditulis ke database: kalau nanti pengguna
 * membuat produk "Gamamilk Plus", sumber `plus_2026` langsung ikut
 * terbaca tanpa perlu mengubah apa pun. Baris pemetaan hanya lahir dari
 * pilihan manusia.
 */
const ALIAS: { kata: string; produk: string }[] = [
  { kata: "phenobody", produk: "phenobody" },
  { kata: "gnait", produk: "gnait" },
  { kata: "etacefit", produk: "etacefit" },
  { kata: "premium", produk: "gamamilk premium" },
  { kata: "sereal", produk: "gamamilk sereal" },
  { kata: "plus", produk: "gamamilk plus" },
  { kata: "utama", produk: "gamamilk" },
];

function tebakProduk(sumberId: string, produk: Produk[]): Produk | null {
  const id = sumberId.toLowerCase();
  for (const alias of ALIAS) {
    if (!id.includes(alias.kata)) continue;
    const cocok = produk.find((p) => p.nama.toLowerCase() === alias.produk);
    if (cocok) return cocok;
  }
  return null;
}

export interface SumberDasar {
  id: string;
  /** Label hasil penamaan tabel, mis. "Plus 2026". */
  label: string;
}

export interface SumberBerproduk {
  id: string;
  /** Nama produk bila sudah dikenali, kalau tidak label tabelnya. */
  label: string;
  /** Keterangan kecil di bawah nama — label tabel, bila berbeda. */
  detail: string | null;
  gambar: string | null;
  /** Benar bila produknya hanya ditebak dari nama tabel. */
  tebakan: boolean;
}

/**
 * Lekatkan produk ke daftar sumber iklan.
 *
 * Dipakai bersama oleh rute Meta dan Google: keduanya mengenal sumber
 * dengan cara berbeda (daftar tetap vs katalog database), tapi label
 * yang dilihat pengguna harus sama-sama bernama produk.
 */
export async function sumberBerproduk(
  platform: Platform,
  daftar: SumberDasar[],
): Promise<SumberBerproduk[]> {
  const [produk, pemetaan] = await Promise.all([
    daftarProduk(),
    daftarPemetaan(),
  ]);

  const perId = new Map(produk.map((p) => [p.id, p]));
  const dipetakan = new Map(
    pemetaan
      .filter((m) => m.platform === platform)
      .map((m) => [m.sumberId, perId.get(m.idProduk)]),
  );

  return daftar.map((sumber) => {
    const pilihan = dipetakan.get(sumber.id);
    const cocok = pilihan ?? tebakProduk(sumber.id, produk);

    if (!cocok) {
      return {
        id: sumber.id,
        label: sumber.label,
        detail: null,
        gambar: null,
        tebakan: false,
      };
    }

    return {
      id: sumber.id,
      label: cocok.nama,
      detail: cocok.nama === sumber.label ? null : sumber.label,
      gambar: cocok.gambar,
      tebakan: pilihan === undefined,
    };
  });
}

/** "Gamamilk Premium" → "gamamilk-premium"; dipakai sebagai id di URL. */
function slug(teks: string): string {
  return teks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface KartuProduk {
  /** Id untuk URL — slug nama produk, bukan nomor baris database. */
  id: string;
  label: string;
  gambar: string | null;
  /** Tabel spend milik produk ini di platform tersebut; bisa kosong. */
  sumberIds: string[];
}

/**
 * Satu kartu per produk, bukan per tabel.
 *
 * Sebuah produk biasanya punya satu tabel spend per tahun, jadi
 * mengurut kartu per tabel membuat "Gamamilk" muncul tiga kali.
 * Tahunnya sendiri sudah terpilih lewat pemilih bulan, jadi tabel mana
 * yang dibaca bisa disimpulkan — bukan urusan pemakai.
 *
 * Produk yang belum punya tabel di platform itu tetap diikutkan dengan
 * `sumberIds` kosong: daftarnya jadi cerminan katalog produk, dan
 * halaman pemanggil yang memutuskan cara menampilkannya.
 */
export async function grupProduk(
  platform: Platform,
  daftar: SumberDasar[],
): Promise<KartuProduk[]> {
  const [produk, pemetaan] = await Promise.all([
    daftarProduk(),
    daftarPemetaan(),
  ]);

  const perId = new Map(produk.map((p) => [p.id, p]));
  const dipetakan = new Map(
    pemetaan
      .filter((m) => m.platform === platform)
      .map((m) => [m.sumberId, perId.get(m.idProduk)]),
  );

  const milik = new Map<number, string[]>();
  const yatim: KartuProduk[] = [];

  for (const sumber of daftar) {
    const cocok = dipetakan.get(sumber.id) ?? tebakProduk(sumber.id, produk);
    if (!cocok) {
      /* Tabel yang belum dikenali tetap bisa dibuka — awalan "tabel-"
         membedakannya dari slug produk. */
      yatim.push({
        id: `tabel-${slug(sumber.id)}`,
        label: sumber.label,
        gambar: null,
        sumberIds: [sumber.id],
      });
      continue;
    }
    milik.set(cocok.id, [...(milik.get(cocok.id) ?? []), sumber.id]);
  }

  return [
    ...produk.map((p) => ({
      id: slug(p.nama),
      label: p.nama,
      gambar: p.gambar,
      sumberIds: milik.get(p.id) ?? [],
    })),
    ...yatim,
  ];
}

/* ---------- perubahan dari halaman setingan ---------- */

/** Batas panjang data URL; ~500 KB sudah jauh di atas gambar 160px. */
const BATAS_GAMBAR = 500_000;

export async function tambahProduk(nama: string, kode: string): Promise<void> {
  await pastikanSkemaProduk();
  await query(
    `INSERT INTO \`${TABEL_PRODUK}\` (nama, kode, urutan)
     VALUES (?, ?, (SELECT COALESCE(MAX(urutan), 0) + 10 FROM \`${TABEL_PRODUK}\` AS t))`,
    [nama, kode],
  );
}

export async function ubahProduk(
  id: number,
  nama: string,
  kode: string,
): Promise<void> {
  await pastikanSkemaProduk();
  await query(
    `UPDATE \`${TABEL_PRODUK}\` SET nama = ?, kode = ? WHERE id = ?`,
    [nama, kode, id],
  );
}

export async function ubahGambarProduk(
  id: number,
  gambar: string | null,
): Promise<void> {
  await pastikanSkemaProduk();

  if (gambar !== null) {
    if (!gambar.startsWith("data:image/")) {
      throw new Error("Gambar harus berupa data URL gambar.");
    }
    if (gambar.length > BATAS_GAMBAR) {
      throw new Error("Gambar terlalu besar setelah diperkecil.");
    }
  }

  await query(`UPDATE \`${TABEL_PRODUK}\` SET gambar = ? WHERE id = ?`, [
    gambar,
    id,
  ]);
}

export async function hapusProduk(id: number): Promise<void> {
  await pastikanSkemaProduk();
  await query(`DELETE FROM \`${TABEL_PEMETAAN}\` WHERE id_produk = ?`, [id]);
  await query(`DELETE FROM \`${TABEL_PRODUK}\` WHERE id = ?`, [id]);
}

/** `idProduk === null` mengembalikan sumber itu ke tebakan otomatis. */
export async function petakanSumber(
  platform: Platform,
  sumberId: string,
  idProduk: number | null,
): Promise<void> {
  await pastikanSkemaProduk();

  if (idProduk === null) {
    await query(
      `DELETE FROM \`${TABEL_PEMETAAN}\` WHERE platform = ? AND sumber_id = ?`,
      [platform, sumberId],
    );
    return;
  }

  await query(
    `INSERT INTO \`${TABEL_PEMETAAN}\` (platform, sumber_id, id_produk)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE id_produk = VALUES(id_produk)`,
    [platform, sumberId, idProduk],
  );
}
