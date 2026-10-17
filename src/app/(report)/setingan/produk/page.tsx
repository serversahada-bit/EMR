import { Card } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import { googleSources } from "@/data/google-queries";
import { META_SOURCES } from "@/data/meta-queries";
import {
  daftarPemetaan,
  daftarProduk,
  sumberBerproduk,
} from "@/data/produk-queries";

import { ProdukView, type SetinganData } from "./ProdukView";

export const dynamic = "force-dynamic";

type Hasil =
  | { status: "ok"; data: SetinganData }
  | { status: "gagal"; pesan: string };

async function ambilData(): Promise<Hasil> {
  try {
    /* googleSources() membaca katalog database dan bisa gagal sendiri
       kalau belum ada tabel Google; itu bukan alasan halaman setingan
       ikut mati, jadi daftarnya dianggap kosong. */
    const google = await googleSources().catch(() => []);
    const produk = await daftarProduk();
    const pemetaan = await daftarPemetaan();

    const [sumberMeta, sumberGoogle] = await Promise.all([
      sumberBerproduk(
        "meta",
        META_SOURCES.map((s) => ({ id: s.id, label: s.label })),
      ),
      sumberBerproduk(
        "google",
        google.map((s) => ({ id: s.id, label: s.label })),
      ),
    ]);

    const eksplisit = new Map(
      pemetaan.map((m) => [`${m.platform}:${m.sumberId}`, m.idProduk]),
    );

    const baris = [
      ...sumberMeta.map((s) => ({ platform: "meta" as const, s })),
      ...sumberGoogle.map((s) => ({ platform: "google" as const, s })),
    ].map(({ platform, s }) => ({
      platform,
      id: s.id,
      /* Label tabel apa adanya; kalau sumbernya sudah bernama produk,
         `detail` yang menyimpannya. */
      labelTabel: s.detail ?? s.label,
      idProduk: eksplisit.get(`${platform}:${s.id}`) ?? null,
      tebakan: s.tebakan ? s.label : null,
    }));

    return { status: "ok", data: { produk, sumber: baris } };
  } catch (error) {
    return {
      status: "gagal",
      pesan:
        error instanceof Error ? error.message : "Penyebab tidak diketahui.",
    };
  }
}

export default async function SetinganProdukPage() {
  const hasil = await ambilData();

  if (hasil.status === "ok") return <ProdukView data={hasil.data} />;

  return (
    <>
      <PageHead
        title="Setingan produk"
        subtitle="Nama dan gambar produk untuk laporan iklan"
      />
      <Card className="p-8">
        <p className="text-center text-sm font-semibold text-ink">
          Gagal membaca database
        </p>
        <p className="mx-auto mt-2 max-w-xl text-center text-xs leading-relaxed text-ink-2">
          Setingan produk disimpan di tabel <code>emr_produk</code> dan{" "}
          <code>emr_sumber_produk</code>, yang dibuat otomatis saat halaman ini
          pertama dibuka. Pesan dari driver: {hasil.pesan}
        </p>
      </Card>
    </>
  );
}
