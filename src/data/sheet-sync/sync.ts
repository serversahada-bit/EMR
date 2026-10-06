import "server-only";

import { withTransaction, type Transaksi } from "../db";
import { KOLOM_DEDUP } from "./header-map";
import { uraiSheet, type BarisTerurai, type KesalahanBaris } from "./parse-sheet";
import { validasiBaris, type SyncInput } from "./row-schema";
import { ambilSheet, extractSpreadsheetId } from "./sheets-client";

/* ──────────────────────────────────────────────────────────────
   Tulis hasil urai sheet ke database.

   Mengarah ke tabel PRODUKSI sejak 2026-10-06, setelah hasilnya
   diverifikasi di tabel cermin: ke-58 kolom dibandingkan terhadap
   produksi September dan hanya `file_gd` yang sengaja berbeda.

   Tabel cermin berakhiran _sync masih ada dan strukturnya identik.
   Untuk menguji perubahan yang berisiko, arahkan peta ini ke sana
   dulu — tidak ada kode lain yang perlu disentuh.
   ────────────────────────────────────────────────────────────── */
export const TABEL = {
  transaksi: "data_transaksi",
  customer: "data_customer",
  cs: "data_cs",
  adv: "data_adv",
  audit: "file_upload_sheet",
} as const;

/** Sheet 3.000 baris jadi 6 perintah, bukan 12.000. */
const UKURAN_BATCH = 500;

export interface RingkasanSync {
  inserted: number;
  updated: number;
  skipped: number;
  errors: KesalahanBaris[];
  /** Baris yang tetap disimpan setelah nilai rusaknya dibersihkan. */
  diperbaiki: number;
  customerDisimpan: number;
  csBaru: string[];
  advBaru: string[];
  kolomTakDikenal: string[];
  namaSpreadsheet: string;
  tabelTujuan: string;
}

function potong<T>(daftar: T[], ukuran: number): T[][] {
  const hasil: T[][] = [];
  for (let i = 0; i < daftar.length; i += ukuran) {
    hasil.push(daftar.slice(i, i + ukuran));
  }
  return hasil;
}

const kutip = (nama: string) => `\`${nama}\``;

/**
 * Baris terakhir menang bila satu kode booking muncul berkali-kali.
 *
 * Tanpa ini jumlah inserted/updated bisa salah hitung, karena satu
 * perintah INSERT yang memuat kunci kembar hanya menulis satu baris
 * tetapi tetap terhitung dua.
 */
function dedup<T>(daftar: T[], kunci: (item: T) => string): T[] {
  const peta = new Map<string, T>();
  for (const item of daftar) peta.set(kunci(item), item);
  return [...peta.values()];
}

async function sudahAda(
  trx: Transaksi,
  tabel: string,
  kolom: string,
  nilai: string[],
): Promise<Set<string>> {
  if (nilai.length === 0) return new Set();

  const tanda = nilai.map(() => "?").join(",");
  const rows = await trx.query<Record<string, string>>(
    `SELECT ${kutip(kolom)} FROM ${tabel} WHERE ${kutip(kolom)} IN (${tanda})`,
    nilai,
  );
  return new Set(rows.map((r) => String(r[kolom])));
}

async function upsertTransaksi(
  trx: Transaksi,
  baris: BarisTerurai[],
): Promise<{ inserted: number; updated: number }> {
  if (baris.length === 0) return { inserted: 0, updated: 0 };

  /* Kolom diambil dari gabungan kunci semua baris; isinya berasal dari
     HEADER_MAP milik kita sendiri, bukan dari isi sheet, jadi aman
     disisipkan sebagai identifier. Nilainya tetap lewat parameter. */
  const kolom = [...new Set(baris.flatMap((b) => Object.keys(b.kolom)))];
  const setel = kolom
    .filter((k) => k !== KOLOM_DEDUP)
    .map((k) => `${kutip(k)}=VALUES(${kutip(k)})`)
    .join(", ");

  let inserted = 0;
  let updated = 0;

  for (const bagian of potong(baris, UKURAN_BATCH)) {
    /* Dihitung sebelum ditulis. affectedRows tidak bisa dipakai karena
       MariaDB melaporkan 0 untuk baris yang nilainya tidak berubah,
       sehingga insert dan update tak lagi bisa dipisahkan. */
    const lama = await sudahAda(
      trx,
      TABEL.transaksi,
      KOLOM_DEDUP,
      bagian.map((b) => b.kodeBooking),
    );
    updated += bagian.filter((b) => lama.has(b.kodeBooking)).length;
    inserted += bagian.filter((b) => !lama.has(b.kodeBooking)).length;

    const tanda = bagian
      .map(() => `(${kolom.map(() => "?").join(",")})`)
      .join(",");
    const params = bagian.flatMap((b) => kolom.map((k) => b.kolom[k] ?? null));

    await trx.exec(
      `INSERT INTO ${TABEL.transaksi} (${kolom.map(kutip).join(",")})
       VALUES ${tanda}
       ON DUPLICATE KEY UPDATE ${setel}`,
      params,
    );
  }

  return { inserted, updated };
}

async function upsertCustomer(
  trx: Transaksi,
  baris: BarisTerurai[],
): Promise<number> {
  const layak = dedup(
    baris.filter((b) => b.bolehSimpanCustomer && b.hp !== ""),
    (b) => b.hp,
  );
  if (layak.length === 0) return 0;

  /* `hp_customer` tidak punya satu format baku: 43.333 baris warisan
     menyimpannya berawalan "+", sementara normalizeHp membuangnya.
     Karena kolom itulah kunci UNIQUE-nya, ON DUPLICATE KEY tidak pernah
     cocok dan setiap customer lama justru tersisip sebagai baris baru —
     sekali jalan sempat membuat 2.286 duplikat. Jadi bentuk yang
     tersimpan dicari dulu, lalu dipakai apa adanya sebagai kunci. */
  const kandidat = layak.flatMap((b) => [b.hp, `+${b.hp}`]);
  const tersimpan = new Map<string, string>();
  for (const bagian of potong(kandidat, UKURAN_BATCH)) {
    const rows = await trx.query<{ hp_customer: string }>(
      `SELECT hp_customer FROM ${TABEL.customer}
       WHERE hp_customer IN (${bagian.map(() => "?").join(",")})`,
      bagian,
    );
    for (const r of rows) {
      tersimpan.set(String(r.hp_customer).replace(/^\+/, ""), r.hp_customer);
    }
  }

  const kolom = [
    "nama_customer",
    "alamat_customer",
    "hp_customer",
    "kecamatan",
    "kabupaten",
    "provinsi",
    "tgl_reg",
    "adv",
  ];

  /* tgl_reg sengaja TIDAK ikut diperbarui: itu tanggal customer pertama
     kali terdaftar, dan menimpanya dengan tanggal transaksi terbaru
     akan menghapus riwayat yang dipakai laporan customer baru. */
  const setel = kolom
    .filter((k) => k !== "hp_customer" && k !== "tgl_reg")
    .map((k) => `${kutip(k)}=VALUES(${kutip(k)})`)
    .join(", ");

  for (const bagian of potong(layak, UKURAN_BATCH)) {
    const tanda = bagian
      .map(() => `(${kolom.map(() => "?").join(",")})`)
      .join(",");

    const params = bagian.flatMap((b) => [
      b.kolom.first_name ?? "",
      b.alamat,
      tersimpan.get(b.hp) ?? b.hp,
      b.kolom.kecamatan ?? "",
      b.kolom.kota ?? "",
      b.kolom.provinsi ?? "",
      b.kolom.tanggal_proses ?? null,
      b.adv,
    ]);

    await trx.exec(
      `INSERT INTO ${TABEL.customer} (${kolom.map(kutip).join(",")})
       VALUES ${tanda}
       ON DUPLICATE KEY UPDATE ${setel}`,
      params,
    );
  }

  return layak.length;
}

/**
 * Tambah nama yang belum ada ke tabel master.
 *
 * `nama_cs` dan `nama_adv` tidak punya indeks UNIQUE, jadi ON DUPLICATE
 * KEY tidak bisa dipakai — yang ada diperiksa sekali lewat satu SELECT,
 * bukan satu query per baris.
 */
async function lengkapiMaster(
  trx: Transaksi,
  tabel: string,
  kolom: string,
  nama: Set<string>,
): Promise<string[]> {
  const daftar = [...nama].filter((n) => n !== "");
  if (daftar.length === 0) return [];

  const ada = await sudahAda(trx, tabel, kolom, daftar);
  const baru = daftar.filter((n) => !ada.has(n));
  if (baru.length === 0) return [];

  await trx.exec(
    `INSERT INTO ${tabel} (${kutip(kolom)}) VALUES ${baru
      .map(() => "(?)")
      .join(",")}`,
    baru,
  );
  return baru;
}

/**
 * Simpan isi sheet yang sudah diambil.
 *
 * Terpisah dari `syncSheet` supaya jalur tulis bisa diuji dengan array
 * buatan, tanpa kredensial Google dan tanpa jaringan.
 */
export async function simpanSheet(
  rows: unknown[][],
  keterangan: { judul: string; tabName: string; operator: string },
): Promise<RingkasanSync> {
  const urai = uraiSheet(rows);

  const errors: KesalahanBaris[] = [...urai.errors];
  const sah: BarisTerurai[] = [];

  let diperbaiki = 0;

  for (const baris of urai.baris) {
    const { fatal, perbaikan } = validasiBaris(baris);
    if (fatal.length > 0) {
      errors.push({ row: baris.nomorBaris, reason: fatal.join("; ") });
      continue;
    }
    if (perbaikan.length > 0) diperbaiki++;
    sah.push(baris);
  }

  /* Asal data dicatat per baris, meniru importer lama yang mengisi
     nama_file_gd dengan judul spreadsheet.
     Kolom pasangannya `file_gd` sengaja DIBIARKAN kosong: di produksi
     isinya kata pertama nama file yang huruf depannya terpotong
     ("FOR PSLU.CLOUD" → "OR", "Draft Orider…" → "raft") — bug off-by-one
     lama yang tidak ada gunanya ditiru. */
  for (const baris of sah) {
    baris.kolom.nama_file_gd = keterangan.judul;

    /* `status` di tabel ini BUKAN status kirim. Seluruh 4.244 baris
       produksi September berisi '1', dan tidak ada satu pun kolom yang
       memuat teks "Selesai"/"Sudah Dikirim" — importer lama memang
       membuang kolom Status dari sheet dan menulis flag tetap. Menyalin
       teksnya ke sini akan membuat baris baru tak terjaring oleh apa pun
       yang menyaring status='1'. */
    baris.kolom.status = "1";
  }

  const siap = dedup(sah, (b) => b.kodeBooking);

  return withTransaction(async (trx) => {
    const { inserted, updated } = await upsertTransaksi(trx, siap);
    const customerDisimpan = await upsertCustomer(trx, siap);

    const csBaru = await lengkapiMaster(
      trx,
      TABEL.cs,
      "nama_cs",
      new Set(siap.map((b) => b.cs)),
    );
    const advBaru = await lengkapiMaster(
      trx,
      TABEL.adv,
      "nama_adv",
      new Set(siap.map((b) => b.adv)),
    );

    await trx.exec(
      `INSERT INTO ${TABEL.audit} (tgl_upload, nama_file, sheet, operator_upload)
       VALUES (NOW(), ?, ?, ?)`,
      [keterangan.judul, keterangan.tabName, keterangan.operator],
    );

    return {
      inserted,
      updated,
      skipped: urai.dilewati + (sah.length - siap.length),
      errors,
      diperbaiki,
      customerDisimpan,
      csBaru,
      advBaru,
      kolomTakDikenal: urai.kolomTakDikenal,
      namaSpreadsheet: keterangan.judul,
      tabelTujuan: TABEL.transaksi,
    };
  });
}

export async function syncSheet(input: SyncInput): Promise<RingkasanSync> {
  const spreadsheetId = extractSpreadsheetId(input.sheetUrl);
  if (!spreadsheetId) {
    throw new Error(
      "URL spreadsheet tidak dikenali. Tempelkan URL lengkap yang memuat /d/<id>/.",
    );
  }

  const { judul, rows } = await ambilSheet(spreadsheetId, input.tabName);
  return simpanSheet(rows, {
    judul,
    tabName: input.tabName,
    operator: input.operator,
  });
}
