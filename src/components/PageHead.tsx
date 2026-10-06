/** Kepala halaman — tiap menu kini punya rute sendiri. */
export function PageHead({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold leading-tight tracking-tight text-ink">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-xs text-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}
