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

/** Tahun registrasi yang tersedia, terbaru lebih dulu. */
export async function daftarTahun(): Promise<number[]> {
  const rows = await query<{ tahun: unknown }>(
    `SELECT DISTINCT YEAR(tgl_reg) AS tahun
     FROM data_customer
     WHERE tgl_reg > '1970-01-01'
     ORDER BY tahun DESC`,
  );
  return rows.map((r) => Number(r.tahun)).filter((t) => t > 1970);
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
