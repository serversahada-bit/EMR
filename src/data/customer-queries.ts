import "server-only";

import { query } from "./db";

/* ──────────────────────────────────────────────────────────────
   Daftar customer dari tabel data_customer (±46 ribu baris).

   Selalu berhalaman: merender seluruh baris sekaligus membuat DOM
   puluhan ribu simpul dan menggantung peramban, sedangkan nilai
   bacanya nol — tidak ada yang menggulir 46 ribu baris.
   ────────────────────────────────────────────────────────────── */

export const PER_HALAMAN = 100;

const num = (value: unknown): number => Number(value ?? 0);
const teks = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

export interface BarisCustomer {
  id: number;
  nama: string;
  hp: string;
  kabupaten: string;
  provinsi: string;
  tglReg: string | null;
  roCount: number;
  adv: string;
}

export interface HalamanCustomer {
  baris: BarisCustomer[];
  /** Total baris yang cocok dengan filter, bukan total tabel. */
  total: number;
  halaman: number;
  jumlahHalaman: number;
}

export interface RingkasCustomer {
  total: number;
  pernahRepeat: number;
  provinsiTeratas: { provinsi: string; jumlah: number }[];
}

export async function ringkasCustomer(): Promise<RingkasCustomer> {
  const [agregat, provinsi] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT COUNT(*) AS total,
              SUM(CAST(COALESCE(NULLIF(ro_count, ''), '0') AS UNSIGNED) > 1) AS repeat_order
       FROM data_customer`,
    ),
    query<Record<string, unknown>>(
      `SELECT COALESCE(NULLIF(TRIM(provinsi), ''), '(tidak diisi)') AS provinsi,
              COUNT(*) AS jumlah
       FROM data_customer
       GROUP BY provinsi
       ORDER BY jumlah DESC
       LIMIT 5`,
    ),
  ]);

  return {
    total: num(agregat[0]?.total),
    pernahRepeat: num(agregat[0]?.repeat_order),
    provinsiTeratas: provinsi.map((r) => ({
      provinsi: String(r.provinsi),
      jumlah: num(r.jumlah),
    })),
  };
}

/**
 * Tahun yang tersedia di dropdown, terbaru lebih dulu.
 *
 * Gabungan dua sumber: tahun registrasi (`data_customer.tgl_reg`, mulai
 * 2024 karena migrasi massal) dan tahun transaksi (`data_transaksi`,
 * mundur sampai 2023). Untuk tahun yang hanya ada di transaksi, daftar
 * customernya diturunkan dari transaksi — lihat `daftarCustomer`.
 */
export async function daftarTahun(): Promise<number[]> {
  const [reg, trx] = await Promise.all([
    query<{ tahun: unknown }>(
      `SELECT DISTINCT YEAR(tgl_reg) AS tahun
       FROM data_customer
       WHERE tgl_reg > '1970-01-01'`,
    ),
    /* MIN/MAX langsung atas kolom (bukan dibungkus YEAR) agar indeks
       tanggal_proses terpakai; rentang tahunnya diisi di sisi JS. */
    query<{ lo: unknown; hi: unknown }>(
      `SELECT MIN(tanggal_proses) AS lo, MAX(tanggal_proses) AS hi
       FROM data_transaksi
       WHERE tanggal_proses > '1970-01-01'`,
    ),
  ]);

  const tahun = new Set<number>();
  for (const r of reg) {
    const t = Number(r.tahun);
    if (t > 1970) tahun.add(t);
  }
  const lo = trx[0]?.lo ? Number(String(trx[0].lo).slice(0, 4)) : 0;
  const hi = trx[0]?.hi ? Number(String(trx[0].hi).slice(0, 4)) : 0;
  if (lo > 1970 && hi >= lo) {
    for (let t = lo; t <= hi; t++) tahun.add(t);
  }

  return [...tahun].sort((a, b) => b - a);
}

/** Daftar provinsi untuk dropdown filter. */
export async function daftarProvinsi(): Promise<string[]> {
  const rows = await query<{ provinsi: string }>(
    `SELECT DISTINCT TRIM(provinsi) AS provinsi
     FROM data_customer
     WHERE TRIM(COALESCE(provinsi, '')) <> ''
     ORDER BY provinsi`,
  );
  return rows.map((r) => r.provinsi);
}

export async function daftarCustomer(opsi: {
  cari?: string;
  provinsi?: string;
  tahun?: number;
  halaman?: number;
}): Promise<HalamanCustomer> {
  const cari = (opsi.cari ?? "").trim();
  const provinsi = (opsi.provinsi ?? "").trim();
  const tahun = opsi.tahun;
  const halaman = Math.max(1, Math.floor(opsi.halaman ?? 1));

  /* Tahun yang tidak punya registrasi di data_customer (mis. 2023)
     dilayani dari data_transaksi. Dicek apa adanya, bukan di-hardcode,
     agar tetap benar bila data_customer kelak mundur ke tahun itu. */
  if (tahun && Number.isInteger(tahun)) {
    const adaReg = await query<{ ada: unknown }>(
      `SELECT EXISTS(
         SELECT 1 FROM data_customer WHERE tgl_reg >= ? AND tgl_reg < ?
       ) AS ada`,
      [`${tahun}-01-01`, `${tahun + 1}-01-01`],
    );
    if (!num(adaReg[0]?.ada)) {
      return daftarCustomerTransaksi({ cari, provinsi, tahun, halaman });
    }
  }

  const syarat: string[] = [];
  const params: Array<string | number> = [];

  if (cari !== "") {
    /* Pencarian bebas atas nama dan nomor HP. Nilainya tetap lewat
       parameter — hanya pola LIKE-nya yang dirakit. */
    syarat.push("(nama_customer LIKE ? OR hp_customer LIKE ?)");
    params.push(`%${cari}%`, `%${cari}%`);
  }
  if (provinsi !== "") {
    syarat.push("TRIM(provinsi) = ?");
    params.push(provinsi);
  }
  if (tahun && Number.isInteger(tahun)) {
    /* Rentang tanggal, bukan YEAR(tgl_reg) = ?: membungkus kolom dalam
       fungsi membuat indeks `tgl_reg` tidak terpakai. */
    syarat.push("tgl_reg >= ? AND tgl_reg < ?");
    params.push(`${tahun}-01-01`, `${tahun + 1}-01-01`);
  }

  const where = syarat.length ? `WHERE ${syarat.join(" AND ")}` : "";

  const hitung = await query<{ total: unknown }>(
    `SELECT COUNT(*) AS total FROM data_customer ${where}`,
    params,
  );
  const total = num(hitung[0]?.total);
  const jumlahHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));
  const halamanAman = Math.min(halaman, jumlahHalaman);

  const rows = await query<Record<string, unknown>>(
    `SELECT id_customer, nama_customer, hp_customer, kabupaten, provinsi,
            tgl_reg, ro_count, adv
     FROM data_customer
     ${where}
     ORDER BY tgl_reg DESC, id_customer DESC
     LIMIT ? OFFSET ?`,
    [...params, PER_HALAMAN, (halamanAman - 1) * PER_HALAMAN],
  );

  return {
    total,
    halaman: halamanAman,
    jumlahHalaman,
    baris: rows.map((row) => ({
      id: num(row.id_customer),
      nama: teks(row.nama_customer),
      hp: teks(row.hp_customer),
      kabupaten: teks(row.kabupaten),
      provinsi: teks(row.provinsi),
      /* Tanggal 0 dari impor lama tidak layak ditampilkan apa adanya. */
      tglReg:
        teks(row.tgl_reg).startsWith("0000") || teks(row.tgl_reg) === ""
          ? null
          : teks(row.tgl_reg).slice(0, 10),
      roCount: num(row.ro_count),
      adv: teks(row.adv),
    })),
  };
}

/**
 * Daftar customer untuk tahun yang hanya ada di data_transaksi (mis.
 * 2023). Satu baris = satu pembeli, dikelompokkan per nomor HP
 * (`contack`, terisi penuh). Nama & HP andal; kabupaten/provinsi
 * diambil dari transaksi dan hanya terisi sebagian (~24%). "Beli ulang"
 * di sini berarti jumlah order pada tahun tersebut, dan "Terdaftar"
 * dikosongkan karena tak ada tanggal registrasi.
 */
async function daftarCustomerTransaksi(opsi: {
  cari: string;
  provinsi: string;
  tahun: number;
  halaman: number;
}): Promise<HalamanCustomer> {
  const { cari, provinsi, tahun, halaman } = opsi;

  const syarat: string[] = [
    "tanggal_proses >= ? AND tanggal_proses < ?",
    "COALESCE(contack, '') <> ''",
  ];
  const params: Array<string | number> = [
    `${tahun}-01-01`,
    `${tahun + 1}-01-01`,
  ];

  if (cari !== "") {
    syarat.push("(first_name LIKE ? OR contack LIKE ?)");
    params.push(`%${cari}%`, `%${cari}%`);
  }
  if (provinsi !== "") {
    /* Ejaan provinsi di transaksi bisa beda huruf besar/kecil dari
       dropdown (yang berasal dari data_customer), jadi dibandingkan
       tanpa peduli kapitalisasi. */
    syarat.push("UPPER(TRIM(provinsi)) = UPPER(?)");
    params.push(provinsi);
  }

  const where = `WHERE ${syarat.join(" AND ")}`;

  const hitung = await query<{ total: unknown }>(
    `SELECT COUNT(DISTINCT contack) AS total FROM data_transaksi ${where}`,
    params,
  );
  const total = num(hitung[0]?.total);
  const jumlahHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));
  const halamanAman = Math.min(halaman, jumlahHalaman);

  const rows = await query<Record<string, unknown>>(
    `SELECT contack,
            MAX(first_name)                 AS nama,
            MAX(NULLIF(TRIM(kota), ''))     AS kota,
            MAX(NULLIF(TRIM(provinsi), '')) AS provinsi,
            COUNT(*)                        AS jumlah_order,
            MAX(NULLIF(TRIM(adv), ''))      AS adv
     FROM data_transaksi
     ${where}
     GROUP BY contack
     ORDER BY MAX(tanggal_proses) DESC
     LIMIT ? OFFSET ?`,
    [...params, PER_HALAMAN, (halamanAman - 1) * PER_HALAMAN],
  );

  return {
    total,
    halaman: halamanAman,
    jumlahHalaman,
    baris: rows.map((row, i) => ({
      /* Tidak ada id_customer di transaksi; id ini hanya kunci baris
         untuk tabel, unik dalam satu halaman. */
      id: (halamanAman - 1) * PER_HALAMAN + i + 1,
      nama: teks(row.nama),
      hp: teks(row.contack),
      kabupaten: teks(row.kota),
      provinsi: teks(row.provinsi),
      tglReg: null,
      roCount: num(row.jumlah_order),
      adv: teks(row.adv),
    })),
  };
}
