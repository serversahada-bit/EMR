import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/Logo";
import { penggunaAktif } from "@/lib/sesi";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Masuk — PT SLU" };

/* Di luar grup (report), jadi tanpa sidebar dan bilah atas. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  /* Sudah login sah (dicek ke database, bukan sekadar cookie) → langsung masuk. */
  if (await penggunaAktif()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div
        className="w-full max-w-sm rounded-2xl border border-hairline bg-surface p-7"
        style={{ boxShadow: "0 1px 2px rgba(11,11,11,0.04)" }}
      >
        <div className="mb-6 flex items-center gap-3">
          <Logo size={38} />
          <div>
            <p className="text-[15px] font-semibold leading-tight text-ink">PT SLU</p>
            <p className="text-xs text-muted">Executive Management Report</p>
          </div>
        </div>

        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
