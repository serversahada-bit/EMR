"use client";

import { useRef, useState, useTransition } from "react";

import { Card, CardHead } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import type { Produk } from "@/data/produk-queries";

import {
  aksiHapusProduk,
  aksiPetakanSumber,
  aksiTambahProduk,
  aksiUbahGambar,
  aksiUbahProduk,
  type HasilSetingan,
} from "./actions";

export interface BarisSumber {
  platform: "meta" | "google";
  id: string;
  /** Nama sumber apa adanya dari tabelnya, mis. "Plus 2026". */
  labelTabel: string;
  /** Produk yang dipilih manusia; null berarti ikut tebakan otomatis. */
  idProduk: number | null;
  /** Nama produk hasil tebakan nama tabel, bila belum dipetakan. */
  tebakan: string | null;
}

export interface SetinganData {
  produk: Produk[];
  sumber: BarisSumber[];
}

/** Sisi terpanjang gambar yang disimpan. Cukup untuk ikon 26–56 px. */
const SISI_MAKS = 160;

/**
 * Perkecil gambar di browser sebelum dikirim.
 *
 * Dilakukan di sini, bukan di server: foto produk dari ponsel bisa
 * beberapa megabyte, sedangkan Server Action dibatasi 1 MB per
 * permintaan. Hasilnya ~5–15 KB — cukup kecil untuk ikut dalam satu
 * baris database dan ditempel langsung di <img>.
 */
async function kecilkan(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const skala = Math.min(1, SISI_MAKS / Math.max(bitmap.width, bitmap.height));
  const lebar = Math.max(1, Math.round(bitmap.width * skala));
  const tinggi = Math.max(1, Math.round(bitmap.height * skala));

  const kanvas = document.createElement("canvas");
  kanvas.width = lebar;
  kanvas.height = tinggi;
  kanvas.getContext("2d")!.drawImage(bitmap, 0, 0, lebar, tinggi);
  bitmap.close();

  const webp = kanvas.toDataURL("image/webp", 0.85);
  /* Peramban lama memulangkan PNG saat diminta WebP; keduanya sama-sama
     bisa dipakai, jadi hasilnya dipakai apa adanya. */
  return webp.startsWith("data:image/") ? webp : kanvas.toDataURL("image/png");
}

export function ProdukView({ data }: { data: SetinganData }) {
  const [pesan, setPesan] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /* Satu pintu untuk semua aksi: pesan galat selalu muncul di tempat
     yang sama, dan tombol-tombol ikut mati selama permintaan berjalan. */
  const jalankan = (aksi: () => Promise<HasilSetingan>) =>
    startTransition(async () => {
      const hasil = await aksi();
      setPesan(hasil.ok ? null : hasil.pesan);
    });

  return (
    <>
      <PageHead
        title="Setingan produk"
        subtitle="Nama dan gambar kecil produk, serta sumber iklan milik tiap produk"
      />

      {pesan ? (
        <p className="mb-4 rounded-xl border border-hairline bg-surface px-4 py-3 text-xs text-ink">
          {pesan}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHead
            title="Produk"
            subtitle="Gambar dipakai di pemilih sumber pada halaman spend iklan."
          />
          <div className="space-y-2 px-5 pb-5">
            {data.produk.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-2">
                Belum ada produk. Tambahkan di bawah.
              </p>
            ) : (
              data.produk.map((p) => (
                <KartuProduk
                  /* Kunci memuat isinya supaya form kembali selaras
                     setelah server menyimpan perubahan. */
                  key={`${p.id}:${p.nama}:${p.kode}:${p.gambar ? "g" : "-"}`}
                  produk={p}
                  pending={pending}
                  jalankan={jalankan}
                  setPesan={setPesan}
                />
              ))
            )}

            <FormTambah pending={pending} jalankan={jalankan} />
          </div>
        </Card>

        <Card>
          <CardHead
            title="Sumber iklan"
            subtitle="Tiap tabel spend ditautkan ke satu produk; itulah nama yang muncul di laporan."
          />
          <div className="px-5 pb-5">
            <TabelSumber
              sumber={data.sumber}
              produk={data.produk}
              pending={pending}
              jalankan={jalankan}
            />
          </div>
        </Card>
      </div>
    </>
  );
}

function KartuProduk({
  produk,
  pending,
  jalankan,
  setPesan,
}: {
  produk: Produk;
  pending: boolean;
  jalankan: (aksi: () => Promise<HasilSetingan>) => void;
  setPesan: (pesan: string | null) => void;
}) {
  const [nama, setNama] = useState(produk.nama);
  const [kode, setKode] = useState(produk.kode ?? "");
  const berkas = useRef<HTMLInputElement>(null);

  const berubah = nama !== produk.nama && nama.trim().length > 0;

  const pilihGambar = async (file: File | undefined) => {
    if (!file) return;
    try {
      const kecil = await kecilkan(file);
      jalankan(() => aksiUbahGambar(produk.id, kecil));
    } catch {
      setPesan("Berkas itu tidak bisa dibaca sebagai gambar.");
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-hairline px-3 py-2.5">
      <Gambar nama={produk.nama} gambar={produk.gambar} ukuran={44} />

      <div className="min-w-0 flex-1">
        <input
          value={nama}
          disabled={pending}
          onChange={(e) => setNama(e.target.value)}
          aria-label={`Nama produk ${produk.nama}`}
          className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs font-medium text-ink hover:border-hairline focus:border-hairline focus:outline-none"
        />
        <input
          value={kode}
          disabled={pending}
          placeholder="kode"
          onChange={(e) => setKode(e.target.value)}
          aria-label={`Kode produk ${produk.nama}`}
          className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[11px] text-muted hover:border-hairline focus:border-hairline focus:outline-none"
        />
      </div>

      <input
        ref={berkas}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pilihGambar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="flex shrink-0 items-center gap-1.5">
        {berubah || kode !== (produk.kode ?? "") ? (
          <Tombol
            pending={pending}
            utama
            onClick={() => jalankan(() => aksiUbahProduk(produk.id, nama, kode))}
          >
            Simpan
          </Tombol>
        ) : null}
        <Tombol pending={pending} onClick={() => berkas.current?.click()}>
          {produk.gambar ? "Ganti gambar" : "Gambar"}
        </Tombol>
        {produk.gambar ? (
          <Tombol
            pending={pending}
            onClick={() => jalankan(() => aksiUbahGambar(produk.id, null))}
          >
            Hapus gambar
          </Tombol>
        ) : null}
        <Tombol
          pending={pending}
          onClick={() => {
            if (confirm(`Hapus produk ${produk.nama}?`)) {
              jalankan(() => aksiHapusProduk(produk.id));
            }
          }}
        >
          Hapus
        </Tombol>
      </div>
    </div>
  );
}

function FormTambah({
  pending,
  jalankan,
}: {
  pending: boolean;
  jalankan: (aksi: () => Promise<HasilSetingan>) => void;
}) {
  const [nama, setNama] = useState("");
  const [kode, setKode] = useState("");

  const kirim = () => {
    if (nama.trim().length === 0) return;
    jalankan(async () => {
      const hasil = await aksiTambahProduk(nama, kode);
      if (hasil.ok) {
        setNama("");
        setKode("");
      }
      return hasil;
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-hairline px-3 py-2.5">
      <input
        value={nama}
        disabled={pending}
        placeholder="Nama produk baru"
        onChange={(e) => setNama(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") kirim();
        }}
        className="min-w-0 flex-1 rounded-md border border-hairline bg-surface px-2 py-1.5 text-xs text-ink"
      />
      <input
        value={kode}
        disabled={pending}
        placeholder="Kode"
        onChange={(e) => setKode(e.target.value)}
        className="w-20 rounded-md border border-hairline bg-surface px-2 py-1.5 text-xs text-ink"
      />
      <Tombol pending={pending} utama onClick={kirim}>
        Tambah
      </Tombol>
    </div>
  );
}

const NAMA_PLATFORM = { meta: "Meta", google: "Google" } as const;

function TabelSumber({
  sumber,
  produk,
  pending,
  jalankan,
}: {
  sumber: BarisSumber[];
  produk: Produk[];
  pending: boolean;
  jalankan: (aksi: () => Promise<HasilSetingan>) => void;
}) {
  if (sumber.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-ink-2">
        Belum ada tabel spend iklan yang terbaca di database.
      </p>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-hairline text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          <th className="py-2 pr-3 font-semibold">Platform</th>
          <th className="py-2 pr-3 font-semibold">Tabel</th>
          <th className="py-2 font-semibold">Produk</th>
        </tr>
      </thead>
      <tbody>
        {sumber.map((row) => (
          <tr key={`${row.platform}:${row.id}`} className="border-b border-hairline/60">
            <td className="py-2 pr-3 text-muted">
              {NAMA_PLATFORM[row.platform]}
            </td>
            <td className="py-2 pr-3 text-ink">{row.labelTabel}</td>
            <td className="py-2">
              <select
                value={row.idProduk === null ? "" : String(row.idProduk)}
                disabled={pending}
                onChange={(e) =>
                  jalankan(() =>
                    aksiPetakanSumber(
                      row.platform,
                      row.id,
                      e.target.value === "" ? null : Number(e.target.value),
                    ),
                  )
                }
                className="w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-xs font-medium text-ink disabled:opacity-60"
              >
                <option value="">
                  {row.tebakan
                    ? `Otomatis — ${row.tebakan}`
                    : "Otomatis — belum dikenali"}
                </option>
                {produk.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Gambar produk, atau inisialnya selama belum ada.
 *
 * <img> biasa, bukan next/image: sumbernya data URL dari database, jadi
 * tidak ada yang bisa dioptimalkan pengoptimal gambar.
 */
function Gambar({
  nama,
  gambar,
  ukuran,
}: {
  nama: string;
  gambar: string | null;
  ukuran: number;
}) {
  const gaya = { width: ukuran, height: ukuran };

  if (gambar) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={gambar}
        alt=""
        style={gaya}
        className="shrink-0 rounded-lg object-cover"
      />
    );
  }

  return (
    <span
      style={gaya}
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-lg bg-sunken text-xs font-semibold text-muted"
    >
      {nama.slice(0, 2).toUpperCase()}
    </span>
  );
}

function Tombol({
  children,
  onClick,
  pending,
  utama = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  pending: boolean;
  utama?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={
        "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-50 " +
        (utama
          ? "border-transparent bg-ink text-surface"
          : "border-hairline bg-surface text-ink-2 hover:text-ink")
      }
    >
      {children}
    </button>
  );
}
