import type { CSSProperties } from "react";

import type { GridSheet } from "@/data/sheet-live";

/* Warna dan ukuran meniru Google Sheets: garis grid abu muda (#e2e3e3,
   di kelas tabel), kepala kolom/baris abu, huruf Arial 10pt. Wadahnya
   sengaja putih tetap — isi sel memakai warna asli sheet, jadi tidak
   ikut tema gelap aplikasi. */
const LEBAR_NOMOR = 46;

const kepala: CSSProperties = {
  background: "#f8f9fa",
  color: "#5f6368",
  border: "1px solid #c7c7c7",
  fontWeight: 400,
  fontSize: 11,
  textAlign: "center",
  padding: 0,
};

/** Satu tab Google Sheets digambar ulang sebagai tabel HTML. */
export function TabelSheet({ grid }: { grid: GridSheet }) {
  const lebar = LEBAR_NOMOR + grid.kolom.reduce((a, k) => a + k.lebar, 0);

  return (
    <div
      className="overflow-auto rounded-xl border border-hairline"
      style={{ maxHeight: "calc(100vh - 260px)", background: "#ffffff" }}
    >
      {/* Gaya bawaan sel ditaruh SEKALI di tabel; tiap <td> hanya membawa
          yang berbeda (lihat sheet-live.ts). */}
      <table
        className="[&_td]:overflow-hidden [&_td]:whitespace-nowrap [&_td]:border [&_td]:border-[#e2e3e3] [&_td]:px-1 [&_td]:py-0 [&_td]:text-left [&_td]:align-bottom [&_td]:leading-tight"
        style={{
          borderCollapse: "collapse",
          tableLayout: "fixed",
          width: lebar,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "10pt",
          color: "#000000",
        }}
      >
        <colgroup>
          <col style={{ width: LEBAR_NOMOR }} />
          {grid.kolom.map((k) => (
            <col key={k.huruf} style={{ width: k.lebar }} />
          ))}
        </colgroup>
        <thead>
          <tr style={{ height: 22 }}>
            <th style={{ ...kepala, position: "sticky", top: 0, left: 0, zIndex: 3 }} />
            {grid.kolom.map((k) => (
              <th key={k.huruf} style={{ ...kepala, position: "sticky", top: 0, zIndex: 2 }}>
                {k.huruf}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.baris.map((b) => (
            <tr key={b.nomor} style={{ height: b.tinggi }}>
              <th style={{ ...kepala, position: "sticky", left: 0, zIndex: 1 }}>{b.nomor}</th>
              {b.sel.map((s, i) =>
                s === null ? null : (
                  <td
                    key={i}
                    rowSpan={s.rowSpan > 1 ? s.rowSpan : undefined}
                    colSpan={s.colSpan > 1 ? s.colSpan : undefined}
                    style={s.gaya}
                  >
                    {s.teks}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
