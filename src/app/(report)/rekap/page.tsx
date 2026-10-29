import Link from "next/link";

import { PageHead } from "@/components/PageHead";
import { IconChat, IconDocument, IconGoogle, IconMeta, IconSnack, IconStore } from "@/components/icons";
import { tanggalTerakhirKanal, type KanalRekap } from "@/data/rekap-queries";

export const dynamic = "force-dynamic";

const KANAL: {
  id: KanalRekap;
  href: string;
  judul: string;
  isi: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactElement;
}[] = [
  { id: "meta", href: "/meta", judul: "Meta Ads", isi: "Spend, lead, dan closing iklan Meta per produk", Icon: IconMeta },
  { id: "google", href: "/google", judul: "Google Ads", isi: "Spend dan hasil iklan Google per produk", Icon: IconGoogle },
  { id: "snack", href: "/snack", judul: "Snack Video", isi: "Spend dan hasil iklan Snack Video", Icon: IconSnack },
  { id: "marketplace", href: "/marketplace", judul: "Marketplace", isi: "Shopee/Lazada & TikTok Shop: omset, box, biaya", Icon: IconStore },
  { id: "crm", href: "/crm", judul: "CRM & blast", isi: "Blast CRM, performa CS, dan repeat order", Icon: IconChat },
  { id: "cos", href: "/roas/cos-harian", judul: "Tabel COS harian", isi: "Spend, omset, dan COS harian per produk dari sheet Cost of Sales", Icon: IconDocument },
];

const tanggal = (t: string | null) =>
  t
    ? new Date(`${t}T00:00:00Z`).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "belum ada data";

/**
 * Rekap data tahunan — induk menu kanal yang datanya dari impor file
 * Progres (bukan realtime). Tiap kartu menuju halaman kanalnya dan
 * menyebut tanggal data terakhir, supaya ketahuan kapan perlu impor ulang.
 */
export default async function RekapPage() {
  const akhir = await tanggalTerakhirKanal();

  return (
    <>
      <PageHead
        title="Rekap data tahunan"
        subtitle="Data per kanal dari file Progres — diperbarui saat impor, bukan realtime"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KANAL.map(({ id, href, judul, isi, Icon }) => (
          <Link
            key={id}
            href={href}
            className="group flex flex-col rounded-2xl border border-hairline bg-surface p-5 transition-colors hover:border-ink-2"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "var(--tint-s1)", color: "var(--s1)" }}
            >
              <Icon size={20} />
            </span>
            <span className="mt-4 text-[15px] font-semibold text-ink">{judul}</span>
            <span className="mt-1 text-xs leading-relaxed text-ink-2">{isi}</span>
            <span className="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-[11px]">
              <span className="text-muted">
                Data terakhir: <strong className="font-semibold text-ink-2">{tanggal(akhir[id])}</strong>
              </span>
              <span className="font-medium text-ink-2 group-hover:text-ink">Lihat →</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
