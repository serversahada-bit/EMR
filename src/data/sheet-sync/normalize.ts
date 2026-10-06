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
  return String(nilai).trim();
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
