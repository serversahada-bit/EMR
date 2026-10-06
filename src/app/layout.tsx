import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Executive Management Report — PT SLU",
  description:
    "Laporan manajemen eksekutif PT SLU — omset, belanja iklan, biaya, dan kinerja operasional.",
};

/* Warna bilah peramban di perangkat mobile mengikuti ungu merek. */
export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
