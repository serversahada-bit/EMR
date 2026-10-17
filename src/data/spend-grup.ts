/**
 * Penggabungan spend harian dari beberapa tabel menjadi satu produk.
 *
 * Satu produk bisa punya lebih dari satu tabel — umumnya satu per
 * tahun, kadang satu per akun iklan. Halaman spend menampilkan satu
 * kartu per produk, jadi barisnya harus dijumlahkan di sini dulu.
 *
 * Modul ini sengaja tanpa `server-only` dan tanpa akses database:
 * isinya murni penggabungan, dipakai bersama oleh rute Meta dan Google.
 */

export interface BarisHarian {
  tanggal: string;
  spend: number;
  klik: number;
  lead: number;
  baris: number;
}

/** Gabungan daftar bulan dari beberapa tabel, terbaru lebih dulu. */
export function gabungBulan(bagian: string[][]): string[] {
  return [...new Set(bagian.flat())].sort((a, b) => b.localeCompare(a));
}

/** Jumlahkan baris harian per tanggal, lalu urut menaik. */
export function gabungHarian(bagian: BarisHarian[][]): BarisHarian[] {
  const per = new Map<string, BarisHarian>();

  for (const baris of bagian.flat()) {
    const ada = per.get(baris.tanggal);
    if (!ada) {
      per.set(baris.tanggal, { ...baris });
      continue;
    }
    ada.spend += baris.spend;
    ada.klik += baris.klik;
    ada.lead += baris.lead;
    ada.baris += baris.baris;
  }

  return [...per.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}

/**
 * Bulan berjalan di zona Asia/Bangkok — zona yang sama dengan halaman
 * ringkasan, supaya pemilih bulan tidak berbeda antar halaman.
 *
 * Dipakai hanya sebagai cadangan: saat produk yang dipilih belum punya
 * satu pun baris, pemilih bulan tetap perlu isi agar bisa dipakai
 * berpindah.
 */
export function bulanSekarang(): string {
  const bagian = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const tahun = bagian.find((item) => item.type === "year")!.value;
  const bulan = bagian.find((item) => item.type === "month")!.value;
  return `${tahun}-${bulan}`;
}
