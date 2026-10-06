/* ──────────────────────────────────────────────────────────────
   Pemetaan nama kolom Google Sheet → kolom tabel data_transaksi.

   Semua pembacaan baris lewat peta ini, tidak pernah lewat indeks
   seperti row[0] atau row[48]. Sheet yang kolomnya digeser atau
   disisipi karena itu tidak diam-diam menulis nilai ke kolom yang
   salah — kolom yang hilang cukup jadi kosong, dan kolom asing
   dilaporkan sebagai tak dikenal.
   ────────────────────────────────────────────────────────────── */

/** Samakan ejaan header sebelum dicocokkan: rapatkan spasi, huruf kecil. */
export function normalizeHeader(nilai: unknown): string {
  return String(nilai ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Akhiran ordinal produk. Sheet warisan memakai campuran "1st", "2nd",
 * "3rd" dan salah ketik seperti "5rd", jadi semuanya diterima sebagai
 * alias alih-alih memaksa satu ejaan.
 */
const ORDINAL = [
  ["1st", "1nd", "1rd", "1th"],
  ["2nd", "2st", "2rd", "2th"],
  ["3rd", "3st", "3nd", "3th"],
  ["4th", "4st", "4nd", "4rd"],
  ["5th", "5st", "5nd", "5rd"],
];

function petaProduk(): Record<string, string> {
  const peta: Record<string, string> = {};
  ORDINAL.forEach((akhiran, i) => {
    for (const a of akhiran) {
      peta[`product_name_${a}`] = `barang_${i + 1}`;
      peta[`product_qty_${a}`] = `jumlah_${i + 1}`;
      peta[`product_price_${a}`] = `harga_${i + 1}`;
    }
  });
  return peta;
}

/** Header (sudah dinormalkan) → nama kolom di data_transaksi. */
export const HEADER_MAP: Record<string, string> = {
  "unique code": "kode_booking",
  "no resi": "resi",
  resi: "resi",
  timestamp: "time_stamp",
  "tanggal proses": "tanggal_proses",
  "tangal proses": "tanggal_proses",
  "harga barang": "total_harga",
  "first name": "first_name",
  "contact*": "contack",
  contact: "contack",
  "address 1*": "alamat",
  "address 1": "alamat",
  "kota/kabupaten": "kota",
  "kota / kabupaten": "kota",
  kecamatan: "kecamatan",
  provinsi: "provinsi",
  "hadiah / bonus": "hadiah",
  "hadiah/bonus": "hadiah",
  "isi paket": "isi_paket",
  "cod value": "cod_value",
  keterangan: "keterangan",
  ekspedisi: "ekspedisi",
  "tipe pembayaran": "tipe_pembayaran",
  "bukti tf": "bukti_tf",
  "usia customer": "usia_customer",
  "keterangan ninja": "ket_ninja",
  "cek cod value": "cek_cod_val",
  "cek harga barang": "cek_harga_barang",
  "jumlah barang": "jumlah",
  "keluhan / penyakit customer": "keluhan",
  "keluhan/penyakit customer": "keluhan",
  keluhan: "keluhan",
  gudang: "gudang",
  cs: "cs",
  adv: "adv",
  ongkir: "ongkir",
  fee: "fee",
  diskon: "diskon",
  ro: "ro",
  promo: "promo",
  bonus: "bonus",
  barang: "barang",
  jumlah: "jumlah",
  harga: "harga",
  ...petaProduk(),
};

/** Kolom yang nilainya dinormalkan sebagai tanggal (DATE). */
export const KOLOM_TANGGAL = new Set(["tanggal_proses"]);

/** Kolom yang nilainya dinormalkan sebagai waktu (DATETIME). */
export const KOLOM_TIMESTAMP = new Set(["time_stamp"]);

/**
 * Kolom yang dibersihkan pemisah ribuannya sebelum disimpan.
 *
 * `ro` dan `promo` sengaja TIDAK di sini: isinya kode seperti "RO20"
 * dan "-", bukan rupiah.
 */
export const KOLOM_UANG = new Set([
  "total_harga",
  "ongkir",
  "fee",
  "diskon",
  "cod_value",
  "harga",
  "harga_1",
  "harga_2",
  "harga_3",
  "harga_4",
  "harga_5",
]);

/**
 * Kolom yang ikut rumus omset. Nilai rusak di sini membatalkan barisnya;
 * di kolom uang lain (harga_1..5, cod_value) cukup dikosongkan, karena
 * membuang satu transaksi utuh gara-gara harga baris keempat yang
 * berisi tanggal Excel justru menghilangkan omset yang sah.
 */
export const KOLOM_OMSET = new Set([
  "total_harga",
  "ongkir",
  "fee",
  "diskon",
]);

/** Kolom kunci dedup transaksi. */
export const KOLOM_DEDUP = "kode_booking";

/** Header penanda baris judul; kolom A-nya harus salah satu dari ini. */
export const HEADER_PENANDA = ["tanggal proses", "tangal proses"];
