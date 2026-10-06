"use client";

import { useActionState } from "react";

import { Card, CardHead } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { formatNumber } from "@/lib/format";

import { jalankanSync, type HasilAksi } from "./actions";

const AWAL: HasilAksi = { status: "awal" };

function Kolom({
  label,
  name,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink">{label}</span>
      <input
        name={name}
        required
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-ink-2"
      />
    </label>
  );
}

function Angka({ label, nilai }: { label: string; nilai: number }) {
  return (
    <div className="rounded-xl border border-hairline bg-page px-4 py-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-ink">
        {formatNumber(nilai)}
      </p>
    </div>
  );
}

export function SyncView({ tabelTujuan }: { tabelTujuan: string }) {
  const [hasil, aksi, menunggu] = useActionState(jalankanSync, AWAL);

  return (
    <>
      <PageHead
        title="Sync Google Sheet"
        subtitle="Tarik baris transaksi dari spreadsheet lalu simpan ke database"
      />

      {/* Sync menulis ke tabel produksi. Operator harus tahu itu sebelum
          menekan tombolnya, bukan sesudah. */}
      <div
        className="mb-5 rounded-xl px-4 py-3 text-xs leading-relaxed text-ink-2"
        style={{ background: "var(--warning-bg)" }}
      >
        <strong className="font-semibold text-ink">
          Menulis ke data produksi.
        </strong>{" "}
        Hasil sync langsung masuk ke{" "}
        <code className="text-[11px]">{tabelTujuan}</code> dan ikut terhitung di
        laporan. Baris dengan Unique Code yang sama akan diperbarui, bukan
        digandakan.
      </div>

      <Card className="mb-5">
        <CardHead
          title="Sumber data"
          subtitle="Spreadsheet harus terbuka untuk umum — Share → Anyone with the link → Viewer"
        />
        <form action={aksi} className="grid gap-4 px-5 pb-5">
          <Kolom
            label="URL Spreadsheet"
            name="sheetUrl"
            placeholder="https://docs.google.com/spreadsheets/d/.../edit"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Kolom label="Nama tab" name="tabName" placeholder="Sheet1" />
            <Kolom
              label="Nama operator"
              name="operator"
              placeholder="dicatat di log upload"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={menunggu}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: "var(--s1)" }}
            >
              {menunggu ? "Menyinkronkan…" : "Jalankan sync"}
            </button>
          </div>
        </form>
      </Card>

      {hasil.status === "galat" ? (
        <div
          className="mb-5 rounded-xl px-4 py-3 text-xs leading-relaxed text-ink-2"
          style={{ background: "var(--critical-bg)" }}
        >
          <strong className="font-semibold text-ink">Sync gagal.</strong>{" "}
          {hasil.pesan}
        </div>
      ) : null}

      {hasil.status === "ok" ? <Ringkasan hasil={hasil.ringkasan} /> : null}
    </>
  );
}

function Ringkasan({
  hasil,
}: {
  hasil: Extract<HasilAksi, { status: "ok" }>["ringkasan"];
}) {
  return (
    <Card>
      <CardHead
        title="Hasil sync"
        subtitle={`${hasil.namaSpreadsheet} → ${hasil.tabelTujuan}`}
      />
      <div className="px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Angka label="Baris baru" nilai={hasil.inserted} />
          <Angka label="Diperbarui" nilai={hasil.updated} />
          <Angka label="Dilewati" nilai={hasil.skipped} />
          <Angka label="Gagal" nilai={hasil.errors.length} />
        </div>

        <dl className="mt-4 grid gap-2 text-xs text-ink-2 sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt>Customer disimpan</dt>
            <dd className="font-medium text-ink">
              {formatNumber(hasil.customerDisimpan)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Baris dibersihkan lalu disimpan</dt>
            <dd className="font-medium text-ink">
              {formatNumber(hasil.diperbaiki)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Master CS baru</dt>
            <dd className="font-medium text-ink">
              {hasil.csBaru.length > 0 ? hasil.csBaru.join(", ") : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Master ADV baru</dt>
            <dd className="font-medium text-ink">
              {hasil.advBaru.length > 0 ? hasil.advBaru.join(", ") : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Kolom sheet tak dikenal</dt>
            <dd className="font-medium text-ink">
              {hasil.kolomTakDikenal.length > 0
                ? hasil.kolomTakDikenal.join(", ")
                : "—"}
            </dd>
          </div>
        </dl>

        {hasil.errors.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-ink">
              Baris yang tidak disimpan
            </p>
            <ul className="max-h-72 overflow-auto rounded-xl border border-hairline bg-page text-xs">
              {hasil.errors.slice(0, 200).map((galat) => (
                <li
                  key={galat.row}
                  className="flex gap-3 border-b border-hairline px-3 py-2 last:border-b-0"
                >
                  <span className="shrink-0 font-medium text-ink">
                    Baris {galat.row}
                  </span>
                  <span className="text-ink-2">{galat.reason}</span>
                </li>
              ))}
            </ul>
            {hasil.errors.length > 200 ? (
              <p className="mt-2 text-[11px] text-muted">
                Menampilkan 200 dari {formatNumber(hasil.errors.length)} baris
                bermasalah.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
