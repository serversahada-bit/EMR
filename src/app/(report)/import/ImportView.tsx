"use client";

import { useActionState, useState } from "react";

import { Card, CardHead } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import type {
  HasilLink,
  KanalImpor,
  RiwayatImpor,
  TargetDb,
} from "@/data/impor-progres";
import { formatIDRPenuh, formatNumber } from "@/lib/format";

import { aksiImpor, type HasilAksi } from "./actions";

const AWAL: HasilAksi = { status: "awal" };

const NAMA_KANAL: Record<string, string> = {
  meta: "Meta",
  google: "Google Ads",
  snack: "Snack Video",
  mp: "Marketplace & TikTok",
  cos_harian: "COS harian",
  cos_bulanan: "COS bulanan",
  crm_blast: "CRM blast",
  crm_ro: "CRM repeat order",
  crm_cs: "CRM per CS",
};

/* Kolom ukuran yang berupa jumlah barang, bukan rupiah. */
const UKURAN_JUMLAH = new Set(["box"]);

function nilai(k: KanalImpor, angka: number): string {
  return UKURAN_JUMLAH.has(k.ukuran)
    ? `${formatNumber(angka)} box`
    : formatIDRPenuh(angka);
}

const WARNA_STATUS: Record<KanalImpor["status"], { bg: string; fg: string }> = {
  sama: { bg: "var(--good-bg)", fg: "var(--good-fg)" },
  BARU: { bg: "var(--tint-s1)", fg: "var(--s1)" },
  berubah: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  "tetap (link kosong)": { bg: "var(--surface-sunken)", fg: "var(--ink-2)" },
};

function Status({ status }: { status: KanalImpor["status"] }) {
  const w = WARNA_STATUS[status];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: w.bg, color: w.fg }}
    >
      {status}
    </span>
  );
}

function Kotak({
  jenis,
  children,
}: {
  jenis: "warning" | "critical" | "good";
  children: React.ReactNode;
}) {
  return (
    <div
      className="mb-5 rounded-xl px-4 py-3 text-xs leading-relaxed text-ink-2"
      style={{ background: `var(--${jenis}-bg)` }}
    >
      {children}
    </div>
  );
}

export function ImportView({
  db,
  skripSiap,
  riwayat,
}: {
  db: TargetDb;
  skripSiap: boolean;
  riwayat: RiwayatImpor[];
}) {
  const [hasil, aksi, menunggu] = useActionState(aksiImpor, AWAL);
  const [teks, setTeks] = useState("");
  const [modeJalan, setModeJalan] = useState<"pratinjau" | "simpan">("pratinjau");

  const linksSekarang = teks.split(/\s+/).filter(Boolean).join(" ");
  /* Simpan hanya untuk link yang PERSIS sudah dipratinjau — kalau isi
     kotak diubah setelah pratinjau, harus dipratinjau ulang dulu. */
  const bolehSimpan =
    hasil.status === "ok" &&
    hasil.mode === "pratinjau" &&
    hasil.links.join(" ") === linksSekarang &&
    hasil.data.hasil.some((h) => !h.galat);

  return (
    <>
      <PageHead
        title="Import Progres"
        subtitle="Tempel link Google Sheet file Progres → pratinjau → simpan ke database"
      />

      {/* Operator harus tahu ke DB mana data ditulis sebelum menekan
          Simpan, bukan sesudah. */}
      <Kotak jenis="warning">
        <strong className="font-semibold text-ink">
          Menulis ke database {db.nama} di {db.host}.
        </strong>{" "}
        Simpan menghapus data produk + bulan + tahun yang sama di tiap tabel
        lalu mengisinya ulang dari sheet (satu transaksi per link). Kanal yang
        hasilnya 0 baris tidak menghapus data lama.
      </Kotak>

      {!skripSiap ? (
        <Kotak jenis="critical">
          <strong className="font-semibold text-ink">
            Skrip impor belum diatur.
          </strong>{" "}
          Tambahkan <code className="text-[11px]">IMPOR_PROGRES_DIR</code>{" "}
          (folder berisi <code className="text-[11px]">impor_progres.py</code>)
          di .env.local lalu jalankan ulang <code className="text-[11px]">npm run dev</code>.
        </Kotak>
      ) : null}

      <Card className="mb-5">
        <CardHead
          title="Link spreadsheet"
          subtitle="Satu link per baris (maks. 10). Produk, bulan, dan tahun dibaca dari judul sheet, mis. “Progres Oktober Gamamilk 2026”. Sheet harus terbuka: Anyone with the link → Viewer."
        />
        <form
          action={aksi}
          onSubmit={(e) => {
            const tombol = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            const mode = tombol?.value === "simpan" ? "simpan" : "pratinjau";
            if (
              mode === "simpan" &&
              !window.confirm(`Simpan ke database ${db.nama} di ${db.host}?`)
            ) {
              e.preventDefault();
              return;
            }
            setModeJalan(mode);
          }}
          className="grid gap-4 px-5 pb-5"
        >
          <textarea
            name="links"
            required
            rows={4}
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/.../edit"
            className="w-full rounded-lg border border-hairline bg-page px-3 py-2 font-mono text-xs text-ink outline-none placeholder:text-muted focus:border-ink-2"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              name="mode"
              value="pratinjau"
              disabled={menunggu || !skripSiap}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: "var(--s1)" }}
            >
              {menunggu && modeJalan === "pratinjau" ? "Mengunduh & mengurai…" : "Pratinjau"}
            </button>
            <button
              type="submit"
              name="mode"
              value="simpan"
              disabled={menunggu || !bolehSimpan}
              className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
              style={{ background: bolehSimpan ? "var(--warning-bg)" : undefined }}
            >
              {menunggu && modeJalan === "simpan" ? "Menyimpan…" : "Simpan ke database"}
            </button>
            {menunggu ? (
              <span className="text-xs text-muted">
                Bisa 1–2 menit per link — jangan tutup halaman ini.
              </span>
            ) : !bolehSimpan && hasil.status !== "ok" ? (
              <span className="text-xs text-muted">
                Simpan aktif setelah pratinjau.
              </span>
            ) : null}
          </div>
        </form>
      </Card>

      {hasil.status === "galat" ? (
        <Kotak jenis="critical">
          <strong className="font-semibold text-ink">Impor gagal.</strong>{" "}
          <span className="whitespace-pre-wrap">{hasil.pesan}</span>
        </Kotak>
      ) : null}

      {hasil.status === "ok" ? (
        <>
          {hasil.mode === "simpan" ? (
            <Kotak jenis="good">
              <strong className="font-semibold text-ink">
                Selesai disimpan ke {hasil.data.db.nama} di {hasil.data.db.host}.
              </strong>{" "}
              Kolom “Cek ulang” di bawah membandingkan DB setelah simpan
              dengan isi sheet — semuanya seharusnya “sama”.
            </Kotak>
          ) : null}
          {hasil.data.hasil.map((h) => (
            <HasilSatuLink key={h.link} h={h} />
          ))}
        </>
      ) : null}

      <Riwayat riwayat={riwayat} />
    </>
  );
}

function HasilSatuLink({ h }: { h: HasilLink }) {
  if (h.galat) {
    return (
      <Kotak jenis="critical">
        <strong className="font-semibold text-ink">Link gagal diproses.</strong>{" "}
        {h.galat}
        <br />
        <span className="break-all text-muted">{h.link}</span>
      </Kotak>
    );
  }

  const kanal = h.kanal ?? [];
  const cek = new Map((h.cek_ulang ?? []).map((k) => [k.kunci, k]));
  const tabKosong = (h.tab ?? []).filter((t) => t.baris === 0);
  const ekstra = Object.entries(h.kolom_tanpa_tempat ?? {});

  return (
    <Card className="mb-5">
      <CardHead
        title={h.judul ?? h.link}
        subtitle={`${h.produk} · ${h.bulan} ${h.tahun}${h.tersimpan ? " · TERSIMPAN" : " · pratinjau, belum disimpan"}`}
      />
      <div className="px-5 pb-5">
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full text-xs">
            <thead className="bg-sunken text-left text-ink-2">
              <tr>
                <th className="px-3 py-2 font-medium">Kanal</th>
                <th className="px-3 py-2 font-medium">Tabel</th>
                <th className="px-3 py-2 text-right font-medium">Dari sheet</th>
                <th className="px-3 py-2 text-right font-medium">
                  {h.tersimpan ? "Di DB sebelum simpan" : "Di DB sekarang"}
                </th>
                <th className="px-3 py-2 font-medium">Status</th>
                {h.tersimpan ? (
                  <th className="px-3 py-2 font-medium">Cek ulang</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {kanal.map((k) => (
                <tr key={k.kunci} className="border-t border-hairline">
                  <td className="px-3 py-2 font-medium text-ink">
                    {NAMA_KANAL[k.kunci] ?? k.kunci}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted">
                    {k.tabel}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">
                    {formatNumber(k.baris_link)} baris
                    <br />
                    <span className="text-ink-2">{nilai(k, k.total_link)}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">
                    {formatNumber(k.baris_db)} baris
                    <br />
                    <span className="text-ink-2">{nilai(k, k.total_db)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Status status={k.status} />
                  </td>
                  {h.tersimpan ? (
                    <td className="px-3 py-2">
                      {cek.get(k.kunci) ? <Status status={cek.get(k.kunci)!.status} /> : "—"}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tabKosong.length > 0 ? (
          <div
            className="mt-4 rounded-xl px-4 py-3 text-xs leading-relaxed text-ink-2"
            style={{ background: "var(--critical-bg)" }}
          >
            <strong className="font-semibold text-ink">
              Sheet terbaca 0 baris:
            </strong>{" "}
            {tabKosong.map((t) => t.tab).join(", ")}. Kalau sheet ini sebenarnya
            terisi, datanya tidak ikut tersimpan — periksa dulu sebelum simpan.
          </div>
        ) : null}

        {(h.catatan ?? []).length > 0 ? (
          <div
            className="mt-4 rounded-xl px-4 py-3 text-xs leading-relaxed text-ink-2"
            style={{ background: "var(--warning-bg)" }}
          >
            <p className="mb-1 font-semibold text-ink">Catatan pengurai</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {h.catatan!.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {ekstra.length > 0 ? (
          <p className="mt-3 text-[11px] text-muted">
            Kolom tanpa tempat di tabel:{" "}
            {ekstra.map(([t, k]) => `${t} (${k.join(", ")})`).join("; ")}
          </p>
        ) : null}

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-ink">Sheet yang dibaca</p>
          <div className="flex flex-wrap gap-1.5">
            {(h.tab ?? []).map((t) => (
              <span
                key={`${t.kanal}-${t.tab}`}
                className="rounded-full border border-hairline px-2 py-0.5 text-[11px]"
                style={
                  t.baris === 0
                    ? { background: "var(--critical-bg)", color: "var(--critical-fg)" }
                    : { color: "var(--ink-2)" }
                }
              >
                {t.tab} · {NAMA_KANAL[t.kanal] ?? t.kanal} · {formatNumber(t.baris)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Riwayat({ riwayat }: { riwayat: RiwayatImpor[] }) {
  return (
    <Card>
      <CardHead title="Riwayat impor" subtitle="15 impor terakhir yang disimpan (emr_import_log)" />
      <div className="px-5 pb-5">
        {riwayat.length === 0 ? (
          <p className="text-xs text-muted">Belum ada impor yang disimpan.</p>
        ) : (
          <ul className="rounded-xl border border-hairline text-xs">
            {riwayat.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-hairline px-3 py-2 last:border-b-0"
              >
                <span className="shrink-0 tabular-nums text-muted">{r.waktu}</span>
                <span className="font-medium text-ink">{r.judul ?? "—"}</span>
                {r.link ? (
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-2 underline decoration-hairline underline-offset-2"
                  >
                    buka sheet
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
