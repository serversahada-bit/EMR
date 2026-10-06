# Lapisan data

Dashboard ini tidak pernah membaca angka langsung dari komponen UI. Semua
tampilan mengambil data lewat `report.ts`, yang membaca satu objek
`ReportSource`. Mengganti data = mengganti objek itu.

## Tiga file

| File | Isi | Perlu diubah? |
|---|---|---|
| `types.ts` | Kontrak data (`ReportSource`, `DivisionMonthFact`, dll.) | Tidak, kecuali struktur berubah |
| `sample.ts` | **Angka contoh** — generator deterministik | Ya, ganti dengan data riil |
| `report.ts` | Agregasi, filter periode, metrik turunan | Tidak |

## Cara memasang data riil

1. Buat file baru, misalnya `src/data/actual.ts`, yang mengekspor satu objek
   bertipe `ReportSource`:

   ```ts
   import type { ReportSource } from "./types";

   export const actualSource: ReportSource = {
     meta: {
       company: "PT ...",
       periodLabel: "Januari – September 2026",
       asOf: "30 September 2026",
       preparedBy: "Divisi Keuangan",
       currency: "IDR",
       isSampleData: false, // mematikan banner "Data contoh"
     },
     divisions: [{ id: "ritel", name: "Ritel & Konsumer", lead: "..." }],
     facts: [
       {
         month: "2026-09",
         divisionId: "ritel",
         revenue: 6_800_000_000,
         target: 7_000_000_000,
         cogs: 4_100_000_000,
         payroll: 1_080_000_000,
         marketing: 540_000_000,
         opex: 630_000_000,
         otherCost: 190_000_000,
         cashIn: 6_500_000_000,
         cashOut: 6_300_000_000,
         headcount: 386,
       },
       // ...satu baris per divisi per bulan
     ],
     initiatives: [],
   };
   ```

2. Tukar satu baris di `report.ts`:

   ```ts
   // const source: ReportSource = sampleSource;
   const source: ReportSource = actualSource;
   ```

Tidak ada komponen, chart, atau tata letak yang perlu disentuh.

## Aturan yang harus dipatuhi data riil

- **Satu baris = satu divisi pada satu bulan.** Jangan kirim angka yang sudah
  diagregasi; agregasi dilakukan `report.ts` supaya filter periode dan filter
  unit bisnis konsisten di seluruh chart.
- **`month` berformat `YYYY-MM`.** Dipakai untuk sort dan rentang periode.
- **Semua nilai moneter dalam rupiah penuh**, bukan ribuan atau juta.
  Pemformatan (`Rp 21,4 M`) dilakukan di lapisan tampilan.
- **Lima komponen biaya menjumlah menjadi total biaya.** `cogs + payroll +
  marketing + opex + otherCost` adalah definisi total biaya di dashboard ini;
  laba bersih = `revenue` − total tersebut. Kalau bagan akun Anda berbeda,
  petakan dulu ke lima ember ini (atau ubah `COST_PARTS` di `src/app/page.tsx`
  beserta `types.ts` — maksimal 5 komponen agar palet warna tetap valid).
- **`headcount` adalah nilai titik akhir bulan**, bukan akumulasi. `report.ts`
  menjumlahkannya antar divisi pada bulan terakhir periode, tidak antar bulan.
- **Minimal 2 bulan data** agar sparkline, tren, dan delta periode punya
  pembanding. Delta dihitung terhadap rentang sebelumnya yang panjangnya sama;
  bila data tidak cukup panjang, tile menampilkan "Tidak ada pembanding".

## Kalau datanya berupa Excel/CSV

Dua pilihan, keduanya tetap memakai kontrak di atas:

- **Konversi sekali jalan** — ubah sheet menjadi array `facts` di file `.ts`
  (paling sederhana, cocok untuk laporan bulanan).
- **Baca saat build** — letakkan CSV di `src/data/`, parse di modul server, lalu
  ekspor `ReportSource`. Halaman saat ini dirender statis, jadi parsing terjadi
  pada waktu build, bukan di browser.

## Data Meta Ads

Dashboard menambahkan dua koleksi lagi pada `ReportSource`: `campaigns` dan
`adsFacts`. Nama field sengaja mengikuti kolom ekspor **Meta Ads Manager**
supaya pemetaan dari CSV-nya lurus.

```ts
campaigns: [
  {
    id: "cmp-retarget",
    name: "Retargeting Katalog Ritel",
    objective: "Konversi",        // tujuan kampanye
    divisionId: "ritel",          // pemilik anggaran
    status: "aktif",              // aktif | dijeda | selesai
  },
],
adsFacts: [
  {
    month: "2026-09",
    campaignId: "cmp-retarget",
    spend: 141_000_000,           // Amount spent
    impressions: 4_412_500,       // Impressions
    reach: 1_423_387,             // Reach
    clicks: 92_600,               // Link clicks
    conversions: 1_665,           // Results (pembelian / prospek)
    conversionValue: 699_300_000, // Conversion value
  },
],
```

Aturan tambahan:

- **Jangan kirim metrik turunan.** CTR, CPC, CPM, CPA, ROAS, dan frekuensi
  semuanya dihitung di `report.ts`. Kalau ikut dikirim, akan ada dua versi angka
  yang bisa berselisih.
- **`campaignId` harus ada di `campaigns`.** Baris dengan id yang tidak dikenal
  akan terbuang saat difilter.
- **Belanja Meta adalah bagian dari `marketing`**, bukan pos biaya terpisah.
  Pada data contoh, belanja iklan diturunkan sebagai porsi dari beban pemasaran
  tiap divisi supaya dua laporan itu tidak saling bertentangan. Kalau data riil
  Anda mencatatnya terpisah, pastikan `marketing` pada `facts` sudah mencakup
  belanja Meta.
- **`reach` tidak bisa dijumlahkan secara benar antar bulan** — orang yang sama
  bisa terhitung di beberapa bulan. Dashboard menampilkan frekuensi periode
  sebagai perkiraan dan menyatakannya di kartu Corong kinerja.
- Kampanye musiman cukup diisi untuk bulan saat ia berjalan; bulan tanpa baris
  otomatis dianggap tidak ada belanja.
