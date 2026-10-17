import { daftarUser } from "@/data/user-queries";
import { wajibLogin } from "@/lib/sesi";

import { UserView } from "./UserView";

export const dynamic = "force-dynamic";

export default async function SetinganUserPage({
  searchParams,
}: {
  searchParams: Promise<{ ganti?: string }>;
}) {
  const [{ ganti }, saya, users] = await Promise.all([
    searchParams,
    wajibLogin(),
    daftarUser(),
  ]);

  return (
    <UserView
      users={users}
      sayaId={saya.id}
      wajibGanti={saya.harusGanti || ganti === "1"}
    />
  );
}
