"use client";

import { useState, useTransition } from "react";

import { Card, CardHead } from "@/components/Card";
import { PageHead } from "@/components/PageHead";
import type { UserEmr } from "@/data/user-queries";

import {
  aksiAturAktif,
  aksiGantiPasswordSaya,
  aksiHapusUser,
  aksiResetPassword,
  aksiTambahUser,
  type HasilUser,
} from "./actions";

const INPUT =
  "w-full rounded-xl border border-hairline bg-page px-3 py-2 text-xs text-ink focus:border-[var(--s1)] focus:outline-none";
const TOMBOL =
  "rounded-xl bg-ink px-3.5 py-2 text-xs font-semibold text-surface disabled:opacity-60";
const TOMBOL_KECIL =
  "rounded-lg border border-hairline px-2.5 py-1 text-[11px] text-ink-2 hover:text-ink disabled:opacity-60";

function waktu(s: string | null): string {
  if (!s) return "belum pernah";
  const [tgl, jam] = s.split(" ");
  const [y, m, d] = tgl.split("-");
  return `${d}/${m}/${y} ${jam?.slice(0, 5) ?? ""}`;
}

export function UserView({
  users,
  sayaId,
  wajibGanti,
}: {
  users: UserEmr[];
  sayaId: number;
  wajibGanti: boolean;
}) {
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [pending, startTransition] = useTransition();

  /* Satu pintu untuk semua aksi, seperti halaman setingan produk:
     pesan selalu di tempat yang sama, tombol mati selama permintaan. */
  const jalankan = (aksi: () => Promise<HasilUser>, lalu?: () => void) =>
    startTransition(async () => {
      const h = await aksi();
      setPesan(h.pesan ? { ok: h.ok, teks: h.pesan } : null);
      if (h.ok) lalu?.();
    });

  return (
    <>
      <PageHead title="Setingan user" subtitle="Akun yang boleh membuka laporan ini" />

      {wajibGanti ? (
        <p
          className="mb-4 rounded-xl px-4 py-3 text-xs font-medium"
          style={{ background: "var(--warning-bg)", color: "var(--warning-fg)" }}
        >
          Akun ini masih memakai password awal atau password yang direset.
          Ganti password dulu di bawah sebelum dipakai.
        </p>
      ) : null}

      {pesan ? (
        <p
          role="status"
          className="mb-4 rounded-xl px-4 py-3 text-xs font-medium"
          style={{
            background: pesan.ok ? "var(--good-bg)" : "var(--critical-bg)",
            color: pesan.ok ? "var(--good-fg)" : "var(--critical-fg)",
          }}
        >
          {pesan.teks}
        </p>
      ) : null}

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <GantiPasswordSaya pending={pending} jalankan={jalankan} />
        <TambahUser pending={pending} jalankan={jalankan} />
      </div>

      <Card>
        <CardHead title="Daftar user" subtitle={`${users.length} akun · disimpan di tabel emr_user`} />
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-hairline text-left text-muted">
                <th className="py-2 font-medium">Username</th>
                <th className="py-2 pl-3 font-medium">Nama</th>
                <th className="py-2 pl-3 font-medium">Status</th>
                <th className="py-2 pl-3 font-medium">Login terakhir</th>
                <th className="py-2 pl-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <BarisUser
                  key={`${u.id}:${u.aktif}:${u.harusGanti}`}
                  user={u}
                  saya={u.id === sayaId}
                  pending={pending}
                  jalankan={jalankan}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

type Jalankan = (aksi: () => Promise<HasilUser>, lalu?: () => void) => void;

function GantiPasswordSaya({ pending, jalankan }: { pending: boolean; jalankan: Jalankan }) {
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");

  return (
    <Card>
      <CardHead title="Ganti password saya" subtitle="Minimal 8 karakter. Perangkat lain yang masih login akan keluar." />
      <form
        className="space-y-2.5 px-5 pb-5"
        onSubmit={(e) => {
          e.preventDefault();
          jalankan(
            () => aksiGantiPasswordSaya(lama, baru, ulang),
            () => {
              setLama("");
              setBaru("");
              setUlang("");
            },
          );
        }}
      >
        <input type="password" autoComplete="current-password" placeholder="Password lama" value={lama} onChange={(e) => setLama(e.target.value)} className={INPUT} required />
        <input type="password" autoComplete="new-password" placeholder="Password baru" value={baru} onChange={(e) => setBaru(e.target.value)} className={INPUT} required />
        <input type="password" autoComplete="new-password" placeholder="Ulangi password baru" value={ulang} onChange={(e) => setUlang(e.target.value)} className={INPUT} required />
        <button type="submit" disabled={pending} className={TOMBOL}>
          Simpan password
        </button>
      </form>
    </Card>
  );
}

function TambahUser({ pending, jalankan }: { pending: boolean; jalankan: Jalankan }) {
  const [username, setUsername] = useState("");
  const [nama, setNama] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Card>
      <CardHead title="Tambah user" subtitle="User baru diminta mengganti password saat login pertama." />
      <form
        className="space-y-2.5 px-5 pb-5"
        onSubmit={(e) => {
          e.preventDefault();
          jalankan(
            () => aksiTambahUser(username, nama, password),
            () => {
              setUsername("");
              setNama("");
              setPassword("");
            },
          );
        }}
      >
        <input placeholder="Username (huruf kecil, tanpa spasi)" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} className={INPUT} required />
        <input placeholder="Nama lengkap (opsional)" autoComplete="off" value={nama} onChange={(e) => setNama(e.target.value)} className={INPUT} />
        <input type="password" placeholder="Password awal" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} required />
        <button type="submit" disabled={pending} className={TOMBOL}>
          Tambah user
        </button>
      </form>
    </Card>
  );
}

function BarisUser({
  user,
  saya,
  pending,
  jalankan,
}: {
  user: UserEmr;
  saya: boolean;
  pending: boolean;
  jalankan: Jalankan;
}) {
  return (
    <tr className="border-b border-hairline/60 last:border-0">
      <td className="py-2 font-medium text-ink">
        {user.username}
        {saya ? <span className="ml-1.5 text-[11px] font-normal text-muted">(anda)</span> : null}
      </td>
      <td className="py-2 pl-3 text-ink-2">{user.nama ?? "—"}</td>
      <td className="py-2 pl-3">
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            background: user.aktif ? "var(--good-bg)" : "var(--surface-sunken)",
            color: user.aktif ? "var(--good-fg)" : "var(--ink-2)",
          }}
        >
          {user.aktif ? "Aktif" : "Nonaktif"}
        </span>
        {user.harusGanti ? <span className="ml-1.5 text-[11px] text-muted">wajib ganti password</span> : null}
      </td>
      <td className="py-2 pl-3 tabular-nums text-ink-2">{waktu(user.loginTerakhir)}</td>
      <td className="py-2 pl-3 text-right">
        {saya ? (
          <span className="text-[11px] text-muted">—</span>
        ) : (
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              disabled={pending}
              className={TOMBOL_KECIL}
              onClick={() => {
                const pw = prompt(`Password baru untuk ${user.username} (minimal 8 karakter):`);
                if (pw) jalankan(() => aksiResetPassword(user.id, pw));
              }}
            >
              Reset password
            </button>
            <button
              type="button"
              disabled={pending}
              className={TOMBOL_KECIL}
              onClick={() => jalankan(() => aksiAturAktif(user.id, !user.aktif))}
            >
              {user.aktif ? "Nonaktifkan" : "Aktifkan"}
            </button>
            <button
              type="button"
              disabled={pending}
              className={TOMBOL_KECIL}
              onClick={() => {
                if (confirm(`Hapus user ${user.username}? Tidak bisa dibatalkan.`)) {
                  jalankan(() => aksiHapusUser(user.id));
                }
              }}
            >
              Hapus
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
