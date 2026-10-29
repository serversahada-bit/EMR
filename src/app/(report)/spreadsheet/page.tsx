import Link from "next/link";

import { Card } from "@/components/Card";
import { MuatUlangOtomatis } from "@/components/MuatUlangOtomatis";
import { PageHead } from "@/components/PageHead";
import { gridTab, infoFile, type GridSheet, type InfoFile, type TabSheet } from "@/data/sheet-live";
import { urlSheetLive } from "@/lib/sheet-link";

import { FormLink, IngatSheet } from "./kontrol";
import { TabelSheet } from "./TabelSheet";

/* Isinya mengikuti Google Sheets saat diminta, jadi tidak bisa
   di-prerender. Data disimpan sementara 45 detik di sheet-live.ts. */
export const dynamic = "force-dynamic";

const SEGAR_DETIK = 60;

/**
 * Spreadsheet live — tempel link Google Sheets, tab tampil dengan bentuk
 * yang sama seperti aslinya (sel gabungan, warna, format Rupiah) dan
 * diperbarui otomatis. Alamat halaman memuat ?id=&tab= sehingga bisa
 * di-bookmark atau dibagikan ke rekan yang juga punya akun EMR.
 */
export default async function SpreadsheetPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; tab?: string }>;
}) {
  const { id, tab } = await searchParams;
  const idAman = id && /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;

  let hasil: { info: InfoFile; aktif: TabSheet; grid: GridSheet } | null = null;
  let galat: string | null = null;
  if (idAman) {
    try {
      const info = await infoFile(idAman);
      if (info.tab.length === 0) throw new Error("Spreadsheet ini tidak punya tab yang bisa ditampilkan.");
      const aktif = info.tab.find((t) => String(t.id) === tab) ?? info.tab[0];
      hasil = { info, aktif, grid: await gridTab(idAman, aktif) };
    } catch (e) {
      galat = e instanceof Error ? e.message : "Penyebab tidak diketahui.";
    }
  }

  return (
    <>
      <PageHead
        title="Spreadsheet live"
        subtitle={`Tempel link Google Sheets — tampil sama seperti aslinya dan diperbarui otomatis tiap ${SEGAR_DETIK} detik`}
      />

      <Card className="mb-4 p-4">
        <FormLink awal={idAman ? `https://docs.google.com/spreadsheets/d/${idAman}/edit` : ""} />
      </Card>

      {galat ? (
        <Card className="p-6">
          <p className="text-sm font-semibold text-ink">Spreadsheet tidak bisa dibaca</p>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-ink-2">{galat}</p>
        </Card>
      ) : null}

      {hasil && idAman ? (
        <>
          <IngatSheet
            id={idAman}
            judul={hasil.info.judul}
            tab={hasil.aktif.id}
            tabJudul={hasil.aktif.judul}
          />

          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold leading-tight text-ink">{hasil.info.judul}</h2>
              <p className="mt-0.5 text-xs text-muted">
                {hasil.aktif.judul} · {hasil.grid.baris.length} baris × {hasil.grid.kolom.length} kolom
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <MuatUlangOtomatis diambil={hasil.grid.diambil} detik={SEGAR_DETIK} />
              <a
                href={`https://docs.google.com/spreadsheets/d/${idAman}/edit#gid=${hasil.aktif.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-ink-2 underline-offset-2 hover:underline"
              >
                Buka di Google Sheets ↗
              </a>
            </div>
          </div>

          <nav className="no-print mb-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Tab spreadsheet">
            {hasil.info.tab.map((t) => {
              const aktif = t.id === hasil.aktif.id;
              return (
                <Link
                  key={t.id}
                  href={urlSheetLive(idAman, t.id)}
                  aria-current={aktif ? "page" : undefined}
                  className={
                    "whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-medium " +
                    (aktif ? "border-transparent text-white" : "border-hairline bg-surface text-ink-2 hover:text-ink")
                  }
                  style={aktif ? { background: "var(--s1)" } : undefined}
                >
                  {t.judul}
                </Link>
              );
            })}
          </nav>

          {hasil.grid.terpotong ? (
            <p className="mb-2 text-[11px] text-muted">
              Tab ini sangat besar — yang ditampilkan hanya 400 baris × 60 kolom pertama.
            </p>
          ) : null}

          {hasil.grid.baris.length === 0 ? (
            <Card className="p-6 text-center text-xs text-ink-2">Tab ini kosong.</Card>
          ) : (
            <TabelSheet grid={hasil.grid} />
          )}
        </>
      ) : null}
    </>
  );
}
