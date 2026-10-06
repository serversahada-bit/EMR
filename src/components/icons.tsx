/* Set ikon garis 20px, stroke 1.5 — ditulis inline agar tidak
   menambah dependensi dan mewarisi currentColor. */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </Icon>
  );
}

export function IconTrend(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 17l5.5-5.5 3.5 3.5L21 6" />
      <path d="M21 11V6h-5" />
    </Icon>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <path d="M15 9h3a2 2 0 0 1 2 2v10" />
      <path d="M8 7h3M8 11h3M8 15h3M3 21h18" />
    </Icon>
  );
}

export function IconFlag(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-1.5 4L16 12H5" />
    </Icon>
  );
}

export function IconWallet(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconDocument(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Icon>
  );
}

/**
 * Lambang Meta — pita tak-hingga.
 *
 * Dua kurva cermin yang bertemu di kiri dan kanan serta berpotongan di
 * tengah, sehingga membentuk dua simpul. Digambar sebagai garis, bukan
 * bidang terisi, agar seragam dengan ikon lain dan ikut mewarisi
 * currentColor saat menunya aktif.
 */
export function IconMeta(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.25 12c0-3.6 1.7-5.4 3.8-5.4 2.7 0 4 3.3 4.6 5.4.7 2.1 2 5.4 4.7 5.4 2.1 0 3.9-1.8 3.9-5.4" />
      <path d="M3.25 12c0 3.6 1.7 5.4 3.8 5.4 2.7 0 4-3.3 4.6-5.4.7-2.1 2-5.4 4.7-5.4 2.1 0 3.9 1.8 3.9 5.4" />
    </Icon>
  );
}

export function IconSync(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11a8 8 0 0 0-13.7-5.3L4 8" />
      <path d="M4 5v3h3" />
      <path d="M4 13a8 8 0 0 0 13.7 5.3L20 16" />
      <path d="M20 19v-3h-3" />
    </Icon>
  );
}

export function IconGear(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 7l1.9 1.1M17.9 15.9l1.9 1.1M4.2 17l1.9-1.1M17.9 8.1L19.8 7" />
    </Icon>
  );
}

export function IconHelp(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.3" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </Icon>
  );
}

export function IconPrint(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 8V3h10v5" />
      <rect x="4" y="8" width="16" height="8" rx="2" />
      <path d="M7 14h10v7H7z" />
    </Icon>
  );
}

export function IconExpand(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" />
    </Icon>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9.5l6 6 6-6" />
    </Icon>
  );
}

export function IconCoins(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="12" cy="6.5" rx="7.5" ry="3" />
      <path d="M4.5 6.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5" />
      <path d="M4.5 11.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5" />
    </Icon>
  );
}

export function IconPercent(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 5L5 19" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </Icon>
  );
}

export function IconPanelToggle(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9.5 4v16" />
      <path d="M15.8 10l-2 2 2 2" />
    </Icon>
  );
}

export function IconMegaphone(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10.5v3a1 1 0 0 0 1 1h2.5L13 19V5L6.5 9.5H4a1 1 0 0 0-1 1z" />
      <path d="M16.5 9a4 4 0 0 1 0 6" />
      <path d="M19 6.5a7.5 7.5 0 0 1 0 11" />
    </Icon>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" />
      <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c2.1.7 3.5 2.3 3.5 4.4" />
    </Icon>
  );
}
