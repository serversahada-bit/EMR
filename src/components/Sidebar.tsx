"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";

import { aturMenu, getMenuServerSnapshot, getMenuSnapshot, subscribeMenu } from "@/lib/menuStore";

import { Logo } from "./Logo";
import {
  IconBuilding,
  IconCoins,
  IconFlag,
  IconGear,
  IconGrid,
  IconGoogle,
  IconSnack,
  IconMeta,
  IconDocument,
  IconSync,
  IconUsers,
  IconPanelToggle,
  IconPercent,
  IconPrint,
  IconStore,
  IconChat,
  IconTruck,
  IconShield,
  IconMegaphone,
  IconWallet,
  IconKey,
  IconTrend,
  IconChevron,
} from "./icons";

/**
 * Tiap menu adalah rute tersendiri.
 *
 * `tampil: false` menyembunyikan item dari sidebar TANPA menghapus
 * halamannya — rutenya tetap hidup dan bisa dibuka langsung lewat
 * URL. Ubah ke `true` begitu sumber data riilnya tersambung.
 *
 * Yang disembunyikan: Unit bisnis, Inisiatif, Biaya (masih data contoh)
 * dan Performa ADV, Pengiriman & retur, Mutu data (isinya belum dibuat —
 * halamannya memakai <BelumTerisi> yang menyebutkan tabel atau sheet
 * pemasoknya). Disembunyikan atas permintaan pengguna 20 Okt 2026.
 */
type IkonMenu = (props: { size?: number; className?: string }) => React.ReactElement;

interface NavItem {
  href: string;
  label: string;
  Icon: IkonMenu;
  tampil?: boolean;
  anak?: NavItem[];
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", Icon: IconGrid, tampil: true },
  { href: "/omset", label: "Omset", Icon: IconCoins, tampil: true },
  {
    /* Menu induk kanal pemasaran (permintaan pengguna 21 Okt 2026): Meta,
       Google, Snack, Marketplace, dan CRM jadi sub-menu Marketing report. */
    href: "/monitoring",
    label: "Marketing report",
    Icon: IconTrend,
    tampil: true,
    anak: [
      { href: "/monitoring/kanal", label: "Per kanal", Icon: IconDocument },
      {
        href: "/meta",
        label: "Meta Ads",
        Icon: IconMeta,
        tampil: true,
        anak: [
          {
            href: "/meta/spend-iklan",
            label: "Tabel spend iklan",
            Icon: IconDocument,
          },
        ],
      },
      {
        href: "/google",
        label: "Google Ads",
        Icon: IconGoogle,
        tampil: true,
        anak: [
          {
            href: "/google/spend-iklan",
            label: "Tabel spend iklan",
            Icon: IconDocument,
          },
        ],
      },
      {
        href: "/snack",
        label: "Snack Video",
        Icon: IconSnack,
        tampil: true,
        anak: [
          {
            href: "/snack/spend-iklan",
            label: "Tabel spend iklan",
            Icon: IconDocument,
          },
        ],
      },
      {
        href: "/marketplace",
        label: "Marketplace",
        Icon: IconStore,
        tampil: true,
        anak: [
          {
            href: "/marketplace/spend-iklan",
            label: "Tabel spend iklan",
            Icon: IconDocument,
          },
        ],
      },
      {
        href: "/crm",
        label: "CRM & blast",
        Icon: IconChat,
        tampil: true,
        anak: [
          { href: "/crm/blast", label: "Blast CRM", Icon: IconDocument },
          { href: "/crm/cs", label: "Performa CS", Icon: IconDocument },
          { href: "/crm/ro", label: "Repeat order", Icon: IconDocument },
        ],
      },
    ],
  },
  {
    href: "/roas",
    label: "ROAS & efisiensi",
    Icon: IconPercent,
    tampil: true,
    anak: [
      {
        href: "/roas/cos-harian",
        label: "Tabel COS harian",
        Icon: IconDocument,
      },
    ],
  },
  { href: "/adv", label: "Performa ADV", Icon: IconMegaphone, tampil: false },
  {
    href: "/pengiriman",
    label: "Pengiriman & retur",
    Icon: IconTruck,
    tampil: false,
  },
  { href: "/customer", label: "Data customer", Icon: IconUsers, tampil: true },
  { href: "/mutu-data", label: "Mutu data", Icon: IconShield, tampil: false },
  { href: "/sync", label: "Sync Sheet", Icon: IconSync, tampil: true },
  {
    href: "/setingan/produk",
    label: "Setingan produk",
    Icon: IconGear,
    tampil: true,
  },
  {
    href: "/setingan/user",
    label: "Setingan user",
    Icon: IconKey,
    tampil: true,
  },
  { href: "/divisi", label: "Unit bisnis", Icon: IconBuilding, tampil: false },
  {
    href: "/inisiatif",
    label: "Inisiatif strategis",
    Icon: IconFlag,
    tampil: false,
  },
  { href: "/biaya", label: "Biaya & marjin", Icon: IconWallet, tampil: false },
];

interface ItemMenu {
  href: string;
  label: string;
  Icon: IkonMenu;
  /** 0 = menu utama, 1 = sub-menu, 2 = sub-sub-menu. */
  tingkat: number;
  /** href semua induknya; item tampil hanya bila semuanya terbuka. */
  leluhur: string[];
  /** href semua keturunannya; >0 berarti menu ini punya sub-menu. */
  keturunan: string[];
}

/**
 * Pohon menu diratakan jadi satu daftar untuk dirender.
 *
 * Menu yang punya sub-menu bisa dibuka-tutup lewat tombol panah, dan
 * terbuka sendiri saat nama menu induknya diklik. Selain itu tertutup,
 * supaya sidebar tidak memanjang. Pilihan diingat di browser (menuStore).
 */
function ratakan(items: NavItem[], tingkat = 0, leluhur: string[] = []): ItemMenu[] {
  return items
    .filter((it) => it.tampil !== false)
    .flatMap((it) => {
      const bawah = ratakan(it.anak ?? [], tingkat + 1, [...leluhur, it.href]);
      return [
        { href: it.href, label: it.label, Icon: it.Icon, tingkat, leluhur, keturunan: bawah.map((b) => b.href) },
        ...bawah,
      ];
    });
}

const MENU: ItemMenu[] = ratakan(NAV);

export function Sidebar({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const simpanan = useSyncExternalStore(subscribeMenu, getMenuSnapshot, getMenuServerSnapshot);
  const pilihan = useMemo<Record<string, boolean>>(() => {
    try {
      return JSON.parse(simpanan);
    } catch {
      return {};
    }
  }, [simpanan]);
  /* Sub-menu TERTUTUP sampai diklik (permintaan pengguna): lewat panah,
     atau dengan mengeklik nama menu induknya. */
  const terbuka = (href: string) => pilihan[href] ?? false;

  return (
    <nav
      aria-label="Navigasi laporan"
      className={
        "no-print fixed inset-y-0 left-0 z-30 flex flex-col border-r border-hairline bg-rail py-3 transition-[width] duration-200 " +
        (expanded ? "w-56 px-3" : "w-14 items-center px-2")
      }
    >
      {/* Kepala: logo, dan saat melebar juga nama laporan */}
      <div
        className={
          expanded
            ? "flex items-center gap-2.5"
            : "flex flex-col items-center gap-2"
        }
      >
        <Link
          href="/"
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          title="PT SLU — Executive Management Report"
        >
          <Logo size={34} />
        </Link>

        {expanded ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-ink">
              PT SLU
            </p>
            <p className="truncate text-[11px] leading-tight text-muted">
              Executive Report
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          title={expanded ? "Perkecil menu" : "Perlebar menu"}
          className={
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-page hover:text-ink " +
            (expanded ? "" : "mt-1")
          }
        >
          <IconPanelToggle size={18} className={expanded ? "" : "rotate-180"} />
          <span className="sr-only">
            {expanded ? "Perkecil menu" : "Perlebar menu"}
          </span>
        </button>
      </div>

      <ul
        className={
          /* min-h-0 wajib: anak flex-column default-nya min-height:auto, jadi
             tanpa ini ul menolak menyusut di bawah tinggi isinya dan
             overflow-y-auto tidak pernah aktif — menunya terpotong, tidak
             bisa di-scroll. overscroll-contain menahan scroll merembet ke
             halaman saat daftar sudah mentok. */
          "mt-5 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain " +
          (expanded ? "" : "items-center")
        }
      >
        {MENU.filter((item) => item.leluhur.every(terbuka)).map((item) => {
          const isActive = pathname === item.href;
          const punyaAnak = item.keturunan.length > 0;
          const buka = punyaAnak && terbuka(item.href);

          return (
            <li
              key={item.href}
              className={"group relative " + (expanded ? "w-full" : "")}
            >
              <Link
                href={item.href}
                onClick={punyaAnak ? () => aturMenu(item.href, true) : undefined}
                aria-current={isActive ? "page" : undefined}
                className={
                  "flex items-center rounded-xl transition-colors " +
                  (expanded
                    ? (item.tingkat === 2
                        ? "h-8 w-full gap-2.5 pl-11 "
                        : item.tingkat === 1
                          ? "h-9 w-full gap-3 pl-7 "
                          : "h-10 w-full gap-3 pl-3 ") + (punyaAnak ? "pr-9" : "pr-3")
                    : "h-10 w-10 justify-center")
                }
                style={{
                  background: isActive ? "var(--rail-active)" : "transparent",
                  color: isActive ? "var(--s1)" : "var(--ink-muted)",
                }}
              >
                <item.Icon
                  className="shrink-0"
                  size={expanded && item.tingkat > 0 ? (item.tingkat === 2 ? 14 : 16) : 18}
                />
                {expanded ? (
                  <span
                    className={
                      "truncate font-medium " +
                      (item.tingkat === 2 ? "text-[11.5px]" : item.tingkat === 1 ? "text-[12px]" : "text-[13px]")
                    }
                    style={{ color: isActive ? "var(--s1)" : "var(--ink-2)" }}
                  >
                    {item.label}
                  </span>
                ) : (
                  <span className="sr-only">{item.label}</span>
                )}
              </Link>

              {punyaAnak && expanded ? (
                <button
                  type="button"
                  onClick={() => aturMenu(item.href, !buka)}
                  aria-expanded={buka}
                  title={buka ? "Tutup sub-menu" : "Buka sub-menu"}
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-page hover:text-ink"
                >
                  <IconChevron size={15} className={"transition-transform " + (buka ? "" : "-rotate-90")} />
                  <span className="sr-only">{buka ? "Tutup" : "Buka"} sub-menu {item.label}</span>
                </button>
              ) : null}

              {/* Saat menu kecil, label muncul sebagai tooltip ketika hover */}
              {!expanded ? (
                <span className="pointer-events-none absolute left-12 top-1/2 z-40 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs font-medium text-ink shadow-[0_4px_14px_rgba(11,11,11,0.1)] group-hover:block">
                  {item.label}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className={"group relative mt-2 " + (expanded ? "w-full" : "")}>
        <button
          type="button"
          onClick={() => window.print()}
          className={
            "flex items-center rounded-xl text-muted transition-colors hover:text-ink " +
            (expanded ? "h-10 w-full gap-3 px-3" : "h-10 w-10 justify-center")
          }
        >
          <IconPrint className="shrink-0" />
          {expanded ? (
            <span className="truncate text-[13px] font-medium">
              Cetak laporan
            </span>
          ) : (
            <span className="sr-only">Cetak laporan</span>
          )}
        </button>

        {!expanded ? (
          <span className="pointer-events-none absolute left-12 top-1/2 z-40 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs font-medium text-ink shadow-[0_4px_14px_rgba(11,11,11,0.1)] group-hover:block">
            Cetak laporan
          </span>
        ) : null}
      </div>
    </nav>
  );
}
