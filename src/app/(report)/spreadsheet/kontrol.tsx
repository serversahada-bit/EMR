"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";

import { bacaLinkSheet, urlSheetLive } from "@/lib/sheet-link";

/* ── daftar link tersimpan (per browser) ─────────────────────────
   Hanya kemudahan per pengguna, jadi cukup localStorage. Semua akses
   dibungkus try/catch: mode privat atau penyimpanan diblokir
   melempar galat, dan halaman harus tetap jalan tanpa daftar ini. */

const KUNCI = "emr:sheet-live";
const EVENT = "emr-sheet-live";

interface Tersimpan {
  id: string;
  judul: string;
  tab: number;
  tabJudul: string;
}

function bacaMentah(): string {
  try {
    return localStorage.getItem(KUNCI) ?? "[]";
  } catch {
    return "[]";
  }
}

function urai(mentah: string): Tersimpan[] {
  try {
    const v = JSON.parse(mentah);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function tulis(daftar: Tersimpan[]) {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(daftar));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* penyimpanan diblokir — abaikan */
  }
}

function langganan(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function useTersimpan(): Tersimpan[] {
  const mentah = useSyncExternalStore(langganan, bacaMentah, () => "[]");
  return urai(mentah);
}

/** Catat spreadsheet yang sedang dibuka ke daftar (paling atas, maks 8). */
export function IngatSheet(item: Tersimpan) {
  const { id, judul, tab, tabJudul } = item;
  useEffect(() => {
    const lain = urai(bacaMentah()).filter((x) => x.id !== id);
    tulis([{ id, judul, tab, tabJudul }, ...lain].slice(0, 8));
  }, [id, judul, tab, tabJudul]);
  return null;
}

/* ── form tempel link ─────────────────────────────────────────── */

export function FormLink({ awal }: { awal: string }) {
  const router = useRouter();
  const [link, setLink] = useState(awal);
  const [galat, setGalat] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const daftar = useTersimpan();

  return (
    <div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const l = bacaLinkSheet(link);
          if (!l) {
            setGalat(
              "Link tidak dikenali. Tempel link Google Sheets, misalnya https://docs.google.com/spreadsheets/d/…",
            );
            return;
          }
          setGalat(null);
          startTransition(() => router.push(urlSheetLive(l.id, l.gid)));
        }}
      >
        <label className="block min-w-0 flex-1">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Link Google Sheets
          </span>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            className="w-full rounded-lg border border-hairline bg-page px-3 py-1.5 text-xs text-ink outline-none placeholder:text-muted focus:border-ink-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          style={{ background: "var(--s1)" }}
        >
          {pending ? "Membuka…" : "Tampilkan"}
        </button>
      </form>

      {galat ? <p className="mt-2 text-xs" style={{ color: "var(--critical-fg)" }}>{galat}</p> : null}
      <p className="mt-2 text-[11px] text-muted">
        Sheet harus dibagikan sebagai &ldquo;Anyone with the link can view&rdquo;. Link yang
        menyertakan <code>gid=</code> langsung membuka tab tersebut.
      </p>

      {daftar.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Terakhir dibuka
          </span>
          {daftar.map((x) => (
            <span
              key={x.id}
              className="inline-flex items-center gap-1 rounded-full border border-hairline bg-page py-1 pl-3 pr-1 text-[11px] text-ink-2"
            >
              <Link href={urlSheetLive(x.id, x.tab)} className="max-w-[260px] truncate hover:text-ink">
                {x.judul} · {x.tabJudul}
              </Link>
              <button
                type="button"
                aria-label={`Hapus ${x.judul} dari daftar`}
                onClick={() => tulis(daftar.filter((y) => y.id !== x.id))}
                className="rounded-full px-1.5 text-muted hover:text-ink"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
