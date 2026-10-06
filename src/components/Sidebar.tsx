"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import {
  IconBuilding,
  IconCoins,
  IconFlag,
  IconGrid,
  IconMeta,
  IconDocument,
  IconSync,
  IconUsers,
  IconPanelToggle,
  IconPrint,
  IconWallet,
} from "./icons";

/**
 * Tiap menu adalah rute tersendiri.
 *
 * `tampil: false` menyembunyikan item dari sidebar TANPA menghapus
 * halamannya — rutenya tetap hidup dan bisa dibuka langsung lewat
 * URL. Ketiga halaman yang disembunyikan masih memakai data contoh;
 * ubah ke `true` begitu sumber data riilnya tersambung.
 */
const NAV = [
  { href: "/", label: "Dashboard", Icon: IconGrid, tampil: true },
  { href: "/omset", label: "Omset", Icon: IconCoins, tampil: true },
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
  { href: "/customer", label: "Data customer", Icon: IconUsers, tampil: true },
  { href: "/sync", label: "Sync Sheet", Icon: IconSync, tampil: true },
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
  Icon: (props: { size?: number; className?: string }) => React.ReactElement;
  /** Benar untuk sub-menu; dipakai menggeser indentasinya. */
  anak: boolean;
}

/**
 * Pohon menu diratakan jadi satu daftar untuk dirender.
 *
 * Sub-menu selalu ikut tampil, tidak hanya saat induknya aktif: dengan
 * satu anak saja, menyembunyikannya hanya membuat halaman itu sulit
 * ditemukan tanpa menghemat ruang yang berarti.
 */
const MENU: ItemMenu[] = NAV.filter((item) => item.tampil).flatMap((item) => [
  { href: item.href, label: item.label, Icon: item.Icon, anak: false },
  ...(item.anak ?? []).map((sub) => ({ ...sub, anak: true })),
]);

export function Sidebar({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

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
          "mt-5 flex flex-1 flex-col gap-1 " + (expanded ? "" : "items-center")
        }
      >
        {MENU.map((item) => {
          const isActive = pathname === item.href;

          return (
            <li
              key={item.href}
              className={"group relative " + (expanded ? "w-full" : "")}
            >
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  "flex items-center rounded-xl transition-colors " +
                  (expanded
                    ? item.anak
                      ? "h-9 w-full gap-3 pl-7 pr-3"
                      : "h-10 w-full gap-3 px-3"
                    : "h-10 w-10 justify-center")
                }
                style={{
                  background: isActive ? "var(--rail-active)" : "transparent",
                  color: isActive ? "var(--s1)" : "var(--ink-muted)",
                }}
              >
                <item.Icon
                  className="shrink-0"
                  size={expanded && item.anak ? 16 : 18}
                />
                {expanded ? (
                  <span
                    className={
                      "truncate font-medium " +
                      (item.anak ? "text-[12px]" : "text-[13px]")
                    }
                    style={{ color: isActive ? "var(--s1)" : "var(--ink-2)" }}
                  >
                    {item.label}
                  </span>
                ) : (
                  <span className="sr-only">{item.label}</span>
                )}
              </Link>

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
