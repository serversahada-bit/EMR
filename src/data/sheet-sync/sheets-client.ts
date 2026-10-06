import "server-only";

/* ──────────────────────────────────────────────────────────────
   Akses Google Sheets lewat API key.

   API key hanya bisa membaca dokumen yang sudah terbuka untuk umum,
   dan itu memang kondisi sheet yang dipakai di sini. Pilihan ini
   menghindari service account sekaligus menghindari parser CSV
   buatan sendiri: responsnya tetap JSON terstruktur dari API resmi.

   Kalau suatu saat sheet-nya ditutup dari publik, API key akan
   ditolak dan perlu diganti service account — pesan error di bawah
   menyebutkan itu supaya penyebabnya tidak perlu ditebak.
   ────────────────────────────────────────────────────────────── */

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Ambil ID spreadsheet dari URL lengkap.
 *
 * Lewat regex, bukan split("/")[5]: URL Google punya beberapa bentuk
 * (/d/ID/edit, /d/ID/edit#gid=0, dengan atau tanpa /u/0/) sehingga
 * posisi indeksnya tidak tetap.
 */
export function extractSpreadsheetId(url: string): string | null {
  const cocok = /\/d\/([a-zA-Z0-9-_]+)/.exec(url);
  return cocok ? cocok[1] : null;
}

/**
 * Bungkus nama tab untuk notasi A1.
 *
 * Nama bertanda spasi atau petik wajib dikutip, dan petik tunggal di
 * dalamnya digandakan — tanpa ini tab bernama "Sheet 1" atau "Data'25"
 * membuat API menolak range-nya.
 */
export function rangeTab(tabName: string, akhir = "A1:BK"): string {
  return `'${tabName.replace(/'/g, "''")}'!${akhir}`;
}

function apiKey(): string {
  const kunci = process.env.GOOGLE_SHEETS_API_KEY;
  if (!kunci) {
    throw new Error(
      "GOOGLE_SHEETS_API_KEY belum diisi di environment. Buat API key di Google Cloud Console (APIs & Services → Credentials), lalu isikan di .env.local dan jalankan ulang server.",
    );
  }
  return kunci;
}

async function panggil<T>(
  jalur: string,
  params: Record<string, string>,
): Promise<T> {
  const query = new URLSearchParams({ ...params, key: apiKey() });
  const respons = await fetch(`${BASE}/${jalur}?${query}`, {
    cache: "no-store",
  });

  if (respons.ok) return (await respons.json()) as T;

  /* Pesan mentah Google menyebut "API key not valid" untuk sebab yang
     sangat berbeda-beda, jadi tiap status diterjemahkan ke tindakan
     yang bisa langsung dikerjakan. */
  if (respons.status === 403) {
    throw new Error(
      "Ditolak Google. Dua sebab tersering: Google Sheets API belum di-Enable pada project API key tersebut, atau spreadsheet-nya tidak terbuka untuk umum. API key hanya bisa membaca sheet yang dibagikan sebagai 'Anyone with the link'.",
    );
  }
  if (respons.status === 404) {
    throw new Error(
      "Spreadsheet atau nama tab tidak ditemukan. Periksa URL dan pastikan nama tab ditulis persis seperti di sheet.",
    );
  }
  if (respons.status === 400) {
    throw new Error(
      `Google menolak permintaan — biasanya nama tab salah. Balasan: ${await respons.text()}`,
    );
  }

  throw new Error(
    `Google Sheets membalas ${respons.status}: ${await respons.text()}`,
  );
}

export interface IsiSheet {
  judul: string;
  rows: unknown[][];
}

export async function ambilSheet(
  spreadsheetId: string,
  tabName: string,
): Promise<IsiSheet> {
  const meta = await panggil<{ properties?: { title?: string } }>(
    spreadsheetId,
    { fields: "properties.title" },
  );

  const nilai = await panggil<{ values?: unknown[][] }>(
    `${spreadsheetId}/values/${encodeURIComponent(rangeTab(tabName))}`,
    {},
  );

  return {
    judul: meta.properties?.title ?? spreadsheetId,
    rows: nilai.values ?? [],
  };
}
