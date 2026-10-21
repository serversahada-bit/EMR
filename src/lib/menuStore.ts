/**
 * Status buka/tutup sub-menu di sidebar, sebagai store eksternal kecil.
 *
 * Pola sama dengan navStore: disimpan di localStorage, dibaca lewat
 * useSyncExternalStore (bukan effect) supaya render server dan hidrasi
 * tidak bentrok. Snapshot berupa STRING JSON agar referensinya stabil
 * antar-render; komponen yang mengurainya.
 *
 * Isinya hanya pilihan EKSPLISIT pengguna ({ "/meta": false, ... }).
 * Menu yang belum pernah diklik mengikuti aturan bawaan di Sidebar
 * (terbuka bila halaman aktif ada di dalamnya).
 */

const KEY = "emr:menu-terbuka";

let listeners: Array<() => void> = [];
let cached: string | null = null;

function readStorage(): string {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function handleStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== KEY) return;
  cached = null;
  emit();
}

export function subscribeMenu(onChange: () => void): () => void {
  if (listeners.length === 0) window.addEventListener("storage", handleStorage);
  listeners.push(onChange);
  return () => {
    listeners = listeners.filter((l) => l !== onChange);
    if (listeners.length === 0) window.removeEventListener("storage", handleStorage);
  };
}

export function getMenuSnapshot(): string {
  if (cached === null) cached = readStorage();
  return cached;
}

/** Server tidak punya localStorage: belum ada pilihan eksplisit. */
export function getMenuServerSnapshot(): string {
  return "{}";
}

export function aturMenu(href: string, terbuka: boolean): void {
  let isi: Record<string, boolean> = {};
  try {
    isi = JSON.parse(getMenuSnapshot());
  } catch {
    /* rusak — mulai dari kosong */
  }
  isi[href] = terbuka;
  cached = JSON.stringify(isi);
  try {
    localStorage.setItem(KEY, cached);
  } catch {
    /* tidak bisa disimpan — tetap berlaku untuk sesi ini */
  }
  emit();
}
