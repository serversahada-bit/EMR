import { Card } from "./Card";
import { PageHead } from "./PageHead";

/**
 * Penanda halaman yang rutenya sudah ada tapi isinya belum dibuat.
 *
 * Bedanya dengan halaman kosong biasa: halaman ini menyebutkan tabel
 * atau sheet mana yang akan jadi sumbernya, supaya yang membuka tahu
 * apa yang kurang — bukan sekadar "coming soon".
 */
export function BelumTerisi({
  title,
  subtitle,
  sumber,
  rencana,
  catatan,
}: {
  title: string;
  subtitle: string;
  /** Tabel database atau sheet Excel yang akan memasok halaman ini. */
  sumber: string[];
  /** Isi yang direncanakan, satu baris per bagian. */
  rencana: string[];
  /** Hal yang perlu diputuskan lebih dulu, kalau ada. */
  catatan?: string;
}) {
  return (
    <>
      <PageHead title={title} subtitle={subtitle} />
      <Card className="p-6">
        <p className="text-sm font-semibold text-ink">Belum terisi</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          Rutenya sudah ada supaya bisa dikerjakan bertahap. Isinya menyusul.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Rencana isi
            </h3>
            <ul className="mt-2 space-y-1.5">
              {rencana.map((baris) => (
                <li
                  key={baris}
                  className="flex gap-2 text-xs leading-relaxed text-ink-2"
                >
                  <span aria-hidden className="text-muted">
                    &bull;
                  </span>
                  <span>{baris}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Sumber data
            </h3>
            <ul className="mt-2 space-y-1.5">
              {sumber.map((baris) => (
                <li key={baris}>
                  <code className="rounded bg-sunken px-1.5 py-0.5 text-[11px] text-ink-2">
                    {baris}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {catatan ? (
          <p className="mt-5 border-t border-hairline pt-4 text-xs leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">Perlu diputuskan: </span>
            {catatan}
          </p>
        ) : null}
      </Card>
    </>
  );
}
