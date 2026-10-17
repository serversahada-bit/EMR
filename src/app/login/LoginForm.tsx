"use client";

import { useActionState } from "react";

import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [hasil, aksi, sedang] = useActionState(login, undefined);

  return (
    <form action={aksi} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="text-xs font-medium text-ink-2">User</span>
        <input
          name="user"
          autoComplete="username"
          autoFocus
          required
          className="mt-1.5 w-full rounded-xl border border-hairline bg-page px-3.5 py-2.5 text-sm text-ink focus:border-[var(--s1)] focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink-2">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 w-full rounded-xl border border-hairline bg-page px-3.5 py-2.5 text-sm text-ink focus:border-[var(--s1)] focus:outline-none"
        />
      </label>

      {hasil?.pesan ? (
        <p
          role="alert"
          className="rounded-xl px-3.5 py-2.5 text-xs font-medium"
          style={{ background: "var(--critical-bg)", color: "var(--critical-fg)" }}
        >
          {hasil.pesan}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={sedang}
        className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-surface transition-opacity disabled:opacity-60"
      >
        {sedang ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
