import { NextResponse, type NextRequest } from "next/server";

import { bacaToken, NAMA_COOKIE } from "@/lib/auth";

/**
 * Semua halaman wajib login, kecuali /login sendiri.
 *
 * Hanya memeriksa tanda tangan cookie (tanpa database) karena proxy
 * berjalan di setiap permintaan, termasuk prefetch. Pemeriksaan ke
 * tabel `emr_user` ada di layout laporan dan Server Action (sesi.ts).
 *
 * /login SELALU diloloskan, walau cookie-nya bertanda tangan sah: user
 * yang dinonaktifkan masih memegang cookie sah, dan kalau proxy
 * memantulkannya ke "/" sementara layout memantulkannya ke /login,
 * terjadilah putaran redirect. Halaman login yang memutuskan sendiri
 * lewat database.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  if (!bacaToken(req.cookies.get(NAMA_COOKIE)?.value)) {
    const tujuan = new URL("/login", req.nextUrl);
    if (pathname !== "/") tujuan.searchParams.set("next", pathname + search);
    return NextResponse.redirect(tujuan);
  }

  return NextResponse.next();
}

export const config = {
  /* Aset build dan gambar tidak perlu diperiksa; ikon tetap boleh
     dimuat di halaman login. */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
