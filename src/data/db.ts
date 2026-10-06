import "server-only";

import mysql from "mysql2/promise";

/**
 * Pool koneksi MySQL. Hanya dipakai di sisi server — kredensial
 * tidak pernah ikut ke browser.
 *
 * Nilai bawaan mengarah ke XAMPP lokal; ubah lewat .env.local.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "dataslu",
  waitForConnections: true,
  connectionLimit: 5,
  /* Tanggal dikembalikan sebagai string agar tidak bergeser zona waktu. */
  dateStrings: true,
  charset: "utf8mb4",
});

export async function query<T>(
  sql: string,
  params: Array<string | number> = [],
): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export interface Transaksi {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Baris terpengaruh — dipakai memastikan batch benar-benar tertulis. */
  exec(sql: string, params?: unknown[]): Promise<number>;
}

/**
 * Jalankan beberapa perintah dalam satu transaksi.
 *
 * Koneksi diambil sendiri dari pool, bukan lewat `query()` di atas:
 * pool.query() bisa memberi koneksi berbeda tiap panggilan, sehingga
 * BEGIN dan COMMIT bisa mendarat di koneksi yang berlainan dan
 * transaksinya tidak pernah benar-benar terbentuk.
 */
export async function withTransaction<T>(
  jalankan: (trx: Transaksi) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const trx: Transaksi = {
      async query<R>(sql: string, params: unknown[] = []): Promise<R[]> {
        const [rows] = await conn.query(sql, params);
        return rows as R[];
      },
      async exec(sql: string, params: unknown[] = []): Promise<number> {
        const [hasil] = await conn.query(sql, params);
        return (hasil as { affectedRows?: number }).affectedRows ?? 0;
      },
    };

    const nilai = await jalankan(trx);
    await conn.commit();
    return nilai;
  } catch (galat) {
    await conn.rollback();
    throw galat;
  } finally {
    conn.release();
  }
}
