/* ──────────────────────────────────────────────────────────────
   Normalisasi nilai mentah dari Google Sheet.

   Semua fungsi di sini murni dan tidak menyentuh database, supaya
   bisa diuji langsung. Nilai dari Sheets API datang sebagai string
   atau number, tergantung format sel — jadi tiap fungsi menerima
   `unknown` dan memutuskan sendiri.
   ────────────────────────────────────────────────────────────── */

/** Hari antara epoch Excel (1899-12-30) dan epoch Unix (1970-01-01). */
const EPOCH_EXCEL = 25569;
const MS_PER_HARI = 86_400_000;

function teks(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return "";
  return bersihkanLatin1(String(nilai).trim());
}

/**
 * Karakter di luar yang bisa disimpan kolom latin1.
 *
 * MySQL menyebutnya "latin1", tapi yang dipakainya sebenarnya cp1252 —
 * rentang 0x80–0x9F terisi tanda kutip melengkung, tanda hubung panjang,
 * dan elipsis. Karakter itu AMAN; yang ditolak hanya di luar daftar ini.
 */
const CP1252_EKSTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

function muatLatin1(titik: number): boolean {
  /* Tab dan baris baru ikut dipertahankan: sel alamat dan keterangan
     memang berisi beberapa baris. */
  if (titik === 0x09 || titik === 0x0a || titik === 0x0d) return true;
  if (titik >= 0x20 && titik <= 0x7e) return true;
  if (titik >= 0xa0 && titik <= 0xff) return true;
  return CP1252_EKSTRA.has(titik);
}

/**
 * Buat sebuah nilai muat di kolom latin1, tanpa membuang isinya.
 *
 * Tabel lama (`data_transaksi`, `data_customer`) seluruhnya latin1,
 * sedangkan nama customer dari WhatsApp kerap memakai huruf hias
 * Unicode 4-byte seperti `𝙎`. Koneksi kita jujur memakai utf8mb4, jadi
 * MySQL benar-benar mengonversi dan menolak baris itu — satu nama
 * menggagalkan seluruh sync, bukan cuma barisnya.
 *
 * Aplikasi PHP lama lolos karena menulis lewat koneksi latin1, yang
 * menyelundupkan byte UTF-8 mentah ke kolom latin1. Hasilnya terbaca
 * sebagai mojibake di dashboard; itu bukan contoh yang diikuti.
 *
 * NFKC mengembalikan huruf hias ke huruf biasa (`𝙎` → `S`), jadi nama
 * tetap terbaca. Yang benar-benar tidak punya padanan — emoji, aksara
 * non-Latin — dibuang, karena kolomnya memang tidak bisa memuatnya.
 */
export function bersihkanLatin1(nilai: string): string {
  let perlu = false;
  for (const huruf of nilai) {
    if (!muatLatin1(huruf.codePointAt(0)!)) {
      perlu = true;
      break;
    }
  }
  /* Jalur cepat: hampir semua sel sudah muat, dan nilainya tidak boleh
     ikut berubah hanya karena fungsi ini dilewati. */
  if (!perlu) return nilai;

  let hasil = "";
  for (const huruf of nilai.normalize("NFKC")) {
    if (muatLatin1(huruf.codePointAt(0)!)) {
      hasil += huruf;
      continue;
    }

    /* Huruf beraksen di luar cp1252 (mis. "Ā") cukup kehilangan
       aksennya, bukan hurufnya. */
    const tanpaAksen = huruf.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (
      tanpaAksen !== "" &&
      [...tanpaAksen].every((h) => muatLatin1(h.codePointAt(0)!))
    ) {
      hasil += tanpaAksen;
    }
  }

  /* Spasi ganda bekas karakter yang dibuang dirapatkan; baris baru
     dibiarkan utuh. */
  return hasil.replace(/ {2,}/g, " ").trim();
}

function duaDigit(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Serial Excel → bagian tanggal dalam UTC.
 *
 * Serial Excel adalah waktu dinding tanpa zona; menghitungnya lewat
 * UTC membuat hasilnya tidak bergeser mengikuti zona waktu mesin
 * yang menjalankan sync. Mesin produksi di Asia/Jakarta, mesin CI
 * bisa di UTC — tanpa ini keduanya memberi tanggal berbeda.
 */
function dariSerialExcel(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const waktu = new Date((serial - EPOCH_EXCEL) * MS_PER_HARI);
  return Number.isNaN(waktu.getTime()) ? null : waktu;
}

/** Tolak tanggal yang komponennya tidak masuk akal, mis. 31/31/2026. */
function rakitTanggal(
  tahun: number,
  bulan: number,
  hari: number,
): string | null {
  if (!Number.isInteger(tahun) || !Number.isInteger(bulan) || !Number.isInteger(hari)) {
    return null;
  }
  if (tahun < 1900 || tahun > 2200) return null;
  if (bulan < 1 || bulan > 12) return null;
  if (hari < 1 || hari > 31) return null;

  /* Pembuktian ulang lewat Date menangkap 31 April atau 29 Februari
     di tahun bukan kabisat, yang lolos pemeriksaan rentang di atas. */
  const uji = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (
    uji.getUTCFullYear() !== tahun ||
    uji.getUTCMonth() !== bulan - 1 ||
    uji.getUTCDate() !== hari
  ) {
    return null;
  }

  return `${tahun}-${duaDigit(bulan)}-${duaDigit(hari)}`;
}

/**
 * Tanggal sheet → "yyyy-mm-dd", atau null bila tidak terbaca.
 *
 * Mengembalikan null, BUKAN string kosong: kolom `tanggal_proses`
 * bertipe DATE, dan menulis "" ke sana menghasilkan 0000-00-00 yang
 * diam-diam lolos lalu merusak semua filter rentang tanggal.
 */
export function normalizeTanggal(nilai: unknown): string | null {
  if (typeof nilai === "number") {
    const waktu = dariSerialExcel(nilai);
    if (!waktu) return null;
    return rakitTanggal(
      waktu.getUTCFullYear(),
      waktu.getUTCMonth() + 1,
      waktu.getUTCDate(),
    );
  }

  /* Sel tanggal kerap membawa jam ("22/09/2026 12:59"). Bagian jam
     dibuang, bukan membuat seluruh barisnya ditolak — sheet September
     2026 punya 710 baris seperti ini, dan menolaknya menghilangkan
     omset ratusan juta tanpa alasan. */
  const isi = teks(nilai).split(/\s+/)[0];
  if (isi === "") return null;

  /* Angka yang terlanjur jadi string tetap diperlakukan sebagai serial. */
  if (/^[0-9]+([.][0-9]+)?$/.test(isi)) {
    return normalizeTanggal(Number(isi));
  }

  const pemisah = isi.includes("/") ? "/" : isi.includes("-") ? "-" : null;
  if (!pemisah) return null;

  const bagian = isi.split(pemisah).map((x) => x.trim());
  if (bagian.length !== 3) return null;
  if (bagian.some((x) => !/^[0-9]+$/.test(x))) return null;

  const angka = bagian.map(Number);

  /* "2026-09-23" sudah dalam urutan yang benar; sisanya dd-mm-yyyy. */
  return bagian[0].length === 4
    ? rakitTanggal(angka[0], angka[1], angka[2])
    : rakitTanggal(angka[2], angka[1], angka[0]);
}

/**
 * Timestamp sheet → "yyyy-mm-dd HH:mm:ss", atau null.
 *
 * Kolom `time_stamp` bertipe DATETIME, jadi bagian jam dipertahankan.
 * Serial Excel menyimpan jam sebagai pecahan hari.
 */
export function normalizeTimestamp(nilai: unknown): string | null {
  if (typeof nilai === "number") {
    const waktu = dariSerialExcel(nilai);
    if (!waktu) return null;
    const tanggal = rakitTanggal(
      waktu.getUTCFullYear(),
      waktu.getUTCMonth() + 1,
      waktu.getUTCDate(),
    );
    if (!tanggal) return null;
    const jam = `${duaDigit(waktu.getUTCHours())}:${duaDigit(
      waktu.getUTCMinutes(),
    )}:${duaDigit(waktu.getUTCSeconds())}`;
    return `${tanggal} ${jam}`;
  }

  const isi = teks(nilai);
  if (isi === "") return null;

  if (/^[0-9]+([.][0-9]+)?$/.test(isi)) {
    return normalizeTimestamp(Number(isi));
  }

  /* "23/09/2026 11:17" atau "23/09/2026 11:17:00" */
  const [bagianTanggal, ...sisa] = isi.split(/\s+/);
  const tanggal = normalizeTanggal(bagianTanggal);
  if (!tanggal) return null;

  const jam = sisa.join(" ").match(/^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?/);
  if (!jam) return `${tanggal} 00:00:00`;

  const h = Number(jam[1]);
  const m = Number(jam[2]);
  const s = Number(jam[3] ?? "0");
  if (h > 23 || m > 59 || s > 59) return `${tanggal} 00:00:00`;

  return `${tanggal} ${duaDigit(h)}:${duaDigit(m)}:${duaDigit(s)}`;
}

/**
 * Angka uang → string angka polos, tanpa pemisah ribuan.
 *
 * Inilah titik masuk korupsi "18.000,00" ke database: CAST di MySQL
 * berhenti di karakter non-angka pertama dan membacanya 18. Dibersihkan
 * di sini supaya baris baru tersimpan bersih sejak awal.
 *
 * Titik hanya dianggap pemisah ribuan bila diikuti TEPAT tiga digit
 * berulang. "16.5" dibiarkan utuh karena itu desimal sungguhan — aturan
 * yang sama dipakai `money()` di omset-queries.ts saat membaca.
 */
export function normalizeUang(nilai: unknown): string {
  if (typeof nilai === "number") {
    return Number.isFinite(nilai) ? String(nilai) : "";
  }

  const asli = teks(nilai);
  if (asli === "") return "";

  /* Spasi dirapatkan hanya untuk mengenali angka seperti "18 000". */
  const rapat = asli.replace(/\s+/g, "");

  if (/^-?[0-9]{1,3}([.][0-9]{3})+(,[0-9]+)?$/.test(rapat)) {
    return rapat.replace(/[.]/g, "").replace(",", ".");
  }
  if (/^-?[0-9]+,[0-9]+$/.test(rapat)) {
    return rapat.replace(",", ".");
  }
  if (/^-?[0-9]+([.][0-9]+)?$/.test(rapat)) {
    return rapat;
  }

  /* Bukan angka (mis. "DKI Jakarta" dari kolom yang bergeser). Dikembalikan
     UTUH — termasuk spasinya — supaya validasi di lapisan atas menolaknya
     dengan pesan yang menyebut isi sel sebenarnya. */
  return asli;
}

/** Nomor HP untuk dedup customer: buang "+" dan pemisah. */
export function normalizeHp(nilai: unknown): string {
  return teks(nilai).replace(/[+\s\-().]/g, "");
}

/** Nama master CS/ADV selalu huruf besar. */
export function normalizeNama(nilai: unknown): string {
  return teks(nilai).toUpperCase();
}

/** Penanda data tersensor: tanda bintang di kontak atau alamat. */
export function tersensor(nilai: unknown): boolean {
  return teks(nilai).includes("*");
}
