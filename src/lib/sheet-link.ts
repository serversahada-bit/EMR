/**
 * Baca ID spreadsheet dan tab (gid) dari link yang ditempel pengguna.
 *
 * Dipakai di klien (form) dan server (halaman), jadi tidak "server-only".
 * Menerima tiga bentuk yang beredar di tim:
 *  - https://docs.google.com/spreadsheets/d/<ID>/edit?gid=<GID>#gid=<GID>
 *  - https://drive.google.com/open?id=<ID>&usp=drive_copy
 *  - <ID> polos
 * ID hanya boleh huruf, angka, "-" dan "_" — nilai lain ditolak, sehingga
 * yang diteruskan ke Google selalu ID, bukan URL bebas.
 */
export function bacaLinkSheet(
  link: string,
): { id: string; gid: number | null } | null {
  const teks = link.trim();
  const id =
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(teks)?.[1] ??
    /[?&]id=([a-zA-Z0-9_-]+)/.exec(teks)?.[1] ??
    (/^[a-zA-Z0-9_-]{25,}$/.test(teks) ? teks : null);
  if (!id) return null;

  const gid = /[#?&]gid=(\d+)/.exec(teks)?.[1];
  return { id, gid: gid === undefined ? null : Number(gid) };
}

/** Alamat halaman Spreadsheet live untuk satu file (dan tab). */
export function urlSheetLive(id: string, tab?: number | null): string {
  const p = new URLSearchParams({ id });
  if (tab !== undefined && tab !== null) p.set("tab", String(tab));
  return `/spreadsheet?${p}`;
}
