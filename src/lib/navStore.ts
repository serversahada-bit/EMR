/**
 * Status lebar sidebar sebagai store eksternal kecil.
 *
 * Disimpan di localStorage, tetapi dibaca lewat useSyncExternalStore
 * dan bukan di dalam effect: render di server selalu memakai nilai
 * "menu kecil", lalu React menukarnya ke nilai tersimpan saat hidrasi
 * tanpa memicu render berantai.
 */

const KEY = "emr:nav-expanded";

let listeners: Array<() => void> = [];
let cached: boolean | null = null;

function readStorage(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    /* Penyimpanan diblokir (mode privat) — anggap menu kecil. */
    return false;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

/** Tab lain mengubah pilihan yang sama. */
function handleStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== KEY) return;
  cached = null;
  emit();
}

export function subscribeNav(onChange: () => void): () => void {
  if (listeners.length === 0) {
    window.addEventListener("storage", handleStorage);
  }
  listeners.push(onChange);

  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
    if (listeners.length === 0) {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function getNavSnapshot(): boolean {
  if (cached === null) cached = readStorage();
  return cached;
}

/** Server tidak punya localStorage; mulai dari menu kecil. */
export function getNavServerSnapshot(): boolean {
  return false;
}

export function toggleNav(): void {
  const next = !getNavSnapshot();
  cached = next;

  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* Tidak bisa disimpan — pilihan tetap berlaku untuk sesi ini. */
  }

  emit();
}
