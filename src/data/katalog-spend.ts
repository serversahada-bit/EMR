import "server-only";

import { query } from "./db";

/**
 * Kanal iklan yang sumbernya ditemukan dari katalog database, bukan dari
 * daftar tetap seperti Meta.
 *
 * Dipakai bersama oleh Google Ads dan Snack Video. Keduanya persis sama
 * perilakunya — temukan tabel berawalan tertentu, saring yang strukturnya
 * cocok, lalu jumlahkan per bulan atau per tanggal — jadi logikanya
 * ditaruh di satu tempat; pembedanya hanya awalan nama tabel dan tahun
 * yang ditampilkan.
 *
 * Kenapa dari katalog, bukan daftar tetap: saat halaman sebuah kanal
 * dibuat, tabelnya kadang belum ada. Daftar tetap berarti menebak nama
 * tabel yang belum tentu dipakai nanti; dengan membaca
 * `information_schema`, halaman langsung hidup begitu tabelnya dibuat
 * tanpa mengubah kode.
 *
 * Tetap aman dari injeksi: nama tabel datang dari server, bukan dari URL,
 * dan masih disaring ulang lewat pola di bawah sebelum pernah disisipkan
 * ke SQL.
 */

export interface KanalSpend {
  /** Awalan nama tabel, mis. "data_spend_google". */
  prefix: string;
  /**
   * Tahun yang ditampilkan. Kosongkan untuk menampilkan semua.
   *
   * Tabel tahun lain tetap ada di database dan tidak dihapus — hanya
   * disembunyikan dari halaman.
   */
  tahunAktif: number[];
}

export interface SumberKanal {
  id: string;
  label: string;
  table: string;
}

/** Kolom yang wajib ada sebelum sebuah tabel bisa dijumlahkan. */
const KOLOM_WAJIB = ["tanggal", "spend_iklan"];

function pola(prefix: string): RegExp {
  return new RegExp(`^${prefix}[a-z0-9_]*$`);
}

/** Tahun pada nama tabel, mis. "..._utama_2024_harian" -> 2024. */
function tahunTabel(tabel: string): number | null {
  const m = tabel.match(/_(20\d\d)_/);
  return m ? Number(m[1]) : null;
}

function ditampilkan(kanal: KanalSpend, tabel: string): boolean {
  if (kanal.tahunAktif.length === 0) return true;
  const th = tahunTabel(tabel);
  /* tabel tanpa tahun di namanya tetap ditampilkan */
  return th === null || kanal.tahunAktif.includes(th);
}

/** "data_spend_google_premium_2025_harian" → "Premium 2025" */
function labelDariTabel(prefix: string, tabel: string): string {
  const sisa = tabel
    .replace(new RegExp(`^${prefix}_?`), "")
    .replace(/_?harian$/, "");
  if (!sisa) return "Utama";
  return sisa
    .split("_")
    .map((kata) =>
      /^\d+$/.test(kata) ? kata : kata.charAt(0).toUpperCase() + kata.slice(1),
    )
    .join(" ");
}

/** Tabel kanal ini yang benar-benar ada, berikut labelnya. */
export async function sumberKanal(kanal: KanalSpend): Promise<SumberKanal[]> {
  /* Alias `AS table_name` WAJIB: MariaDB mengembalikan kolom ini sebagai
     `table_name`, tetapi MySQL 8 sebagai `TABLE_NAME` — tanpa alias,
     row.table_name kosong dan semua tabel dianggap tidak ada (terjadi di
     server Coolify). Sama di mp-queries.ts dan cos-queries.ts. */
  const rows = await query<{ table_name: string }>(
    `SELECT table_name AS table_name
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name LIKE ?
     ORDER BY table_name`,
    [`${kanal.prefix}%`],
  );

  const sah = pola(kanal.prefix);
  return rows
    .map((row) => String(row.table_name))
    .filter((tabel) => sah.test(tabel) && ditampilkan(kanal, tabel))
    .map((tabel) => ({
      id: tabel.replace(new RegExp(`^${kanal.prefix}_?`), "") || "utama",
      label: labelDariTabel(kanal.prefix, tabel),
      table: tabel,
    }));
}

/** Nama kolom beberapa tabel sekaligus. */
async function kolomTabel(prefix: string): Promise<Map<string, Set<string>>> {
  const rows = await query<{ table_name: string; column_name: string }>(
    `SELECT table_name AS table_name, column_name AS column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name LIKE ?`,
    [`${prefix}%`],
  );

  const kolom = new Map<string, Set<string>>();
  for (const row of rows) {
    const nama = String(row.table_name);
    if (!kolom.has(nama)) kolom.set(nama, new Set());
    kolom.get(nama)!.add(String(row.column_name));
  }
  return kolom;
}

/**
 * Saring sumber yang strukturnya belum cocok.
 *
 * Tanpa ini, satu tabel dengan skema berbeda membuat seluruh halaman
 * gagal — bukan hanya baris tabel itu.
 */
export async function sumberTerpakai(
  kanal: KanalSpend,
): Promise<SumberKanal[]> {
  const sources = await sumberKanal(kanal);
  if (sources.length === 0) return [];

  const kolom = await kolomTabel(kanal.prefix);
  return sources.filter((s) => {
    const punya = kolom.get(s.table);
    return punya ? KOLOM_WAJIB.every((k) => punya.has(k)) : false;
  });
}

export interface BulanSumber {
  sourceId: string;
  month: string;
  spend: number;
  records: number;
  lastDate: string;
}

/** Jumlah spend_iklan per bulan dari seluruh tabel kanal ini. */
export async function bulanSumberKanal(kanal: KanalSpend): Promise<{
  sources: SumberKanal[];
  months: BulanSumber[];
}> {
  const sources = await sumberTerpakai(kanal);
  if (sources.length === 0) return { sources: [], months: [] };

  const selects = sources.map(
    (source) =>
      `SELECT '${source.id}' AS sourceId,
              DATE_FORMAT(tanggal, '%Y-%m') AS month,
              COUNT(*) AS records,
              COALESCE(SUM(spend_iklan), 0) AS spend,
              MAX(tanggal) AS lastDate
       FROM \`${source.table}\`
       WHERE tanggal IS NOT NULL AND tanggal > '1970-01-01'
       GROUP BY DATE_FORMAT(tanggal, '%Y-%m')`,
  );

  const rows = await query<Record<string, unknown>>(
    selects.join(" UNION ALL ") + " ORDER BY month, sourceId",
  );

  return {
    sources,
    months: rows.map((row) => ({
      sourceId: String(row.sourceId),
      month: String(row.month),
      spend: Number(row.spend ?? 0),
      records: Number(row.records ?? 0),
      lastDate: String(row.lastDate),
    })),
  };
}

/**
 * Nama tabel untuk sebuah id sumber.
 *
 * Dicari lewat hasil penemuan di atas, bukan disusun dari masukan: nama
 * tabel tidak bisa diparameterkan di SQL, jadi satu-satunya cara aman
 * adalah memastikan nilainya berasal dari katalog database kita sendiri.
 */
async function tabelSumber(
  kanal: KanalSpend,
  sourceId: string,
): Promise<string | null> {
  const sources = await sumberTerpakai(kanal);
  return sources.find((s) => s.id === sourceId)?.table ?? null;
}

/** Bulan yang punya data pada satu sumber, terbaru lebih dulu. */
export async function bulanSatuSumber(
  kanal: KanalSpend,
  sourceId: string,
): Promise<string[]> {
  const tabel = await tabelSumber(kanal, sourceId);
  if (!tabel) return [];

  const rows = await query<{ bulan: string }>(
    `SELECT DISTINCT DATE_FORMAT(tanggal, '%Y-%m') AS bulan
     FROM \`${tabel}\`
     WHERE tanggal IS NOT NULL AND tanggal > '1970-01-01'
     ORDER BY bulan DESC`,
  );
  return rows.map((r) => r.bulan);
}

export interface SpendHarianKanal {
  /** "2026-10-01" */
  tanggal: string;
  spend: number;
  klik: number;
  lead: number;
  /** Baris mentah yang dijumlahkan — >1 berarti beberapa akun iklan. */
  baris: number;
}

/** "2026-10" → ["2026-10-01", "2026-11-01"] (batas atas eksklusif). */
function batasBulan(bulan: string): [string, string] {
  const tahun = Number(bulan.slice(0, 4));
  const ke = Number(bulan.slice(5, 7));
  const akhir =
    ke === 12
      ? `${tahun + 1}-01-01`
      : `${tahun}-${String(ke + 1).padStart(2, "0")}-01`;
  return [`${bulan}-01`, akhir];
}

/**
 * Spend harian satu sumber untuk satu bulan.
 *
 * Dijumlahkan per tanggal karena sebuah tabel bisa memuat beberapa baris
 * untuk hari yang sama (satu per akun iklan); tanpa agregasi, tabelnya
 * menampilkan tanggal berulang tanpa penjelasan.
 *
 * Kolom klik dan lead tidak selalu bernama sama antar kanal — hanya
 * `tanggal` dan `spend_iklan` yang diwajibkan — jadi keduanya dipilih
 * dari kolom yang memang tersedia. Google memecah klik jadi GSN dan
 * non-GSN, keduanya dijumlahkan.
 */
export async function spendHarianKanal(
  kanal: KanalSpend,
  sourceId: string,
  bulan: string,
): Promise<SpendHarianKanal[]> {
  const tabel = await tabelSumber(kanal, sourceId);
  if (!tabel) return [];

  const ada = (await kolomTabel(kanal.prefix)).get(tabel) ?? new Set<string>();

  const kolomKlik = [
    "klik_tautan",
    "klik_tautan_non_gsn",
    "klik_tautan_gsn",
  ].filter((k) => ada.has(k));
  const klik = kolomKlik.length
    ? kolomKlik.map((k) => `COALESCE(SUM(${k}), 0)`).join(" + ")
    : "NULL";

  const lead = ada.has("total_lead_real")
    ? "SUM(total_lead_real)"
    : ada.has("total_lead_dashboard")
      ? "SUM(total_lead_dashboard)"
      : "NULL";

  const rows = await query<Record<string, unknown>>(
    `SELECT tanggal,
            COALESCE(SUM(spend_iklan), 0) AS spend,
            COALESCE(${klik}, 0)          AS klik,
            COALESCE(${lead}, 0)          AS lead_real,
            COUNT(*)                      AS baris
     FROM \`${tabel}\`
     WHERE tanggal >= ? AND tanggal < ?
     GROUP BY tanggal
     ORDER BY tanggal`,
    batasBulan(bulan),
  );

  return rows.map((row) => ({
    tanggal: String(row.tanggal),
    spend: Number(row.spend ?? 0),
    klik: Number(row.klik ?? 0),
    lead: Number(row.lead_real ?? 0),
    baris: Number(row.baris ?? 0),
  }));
}
