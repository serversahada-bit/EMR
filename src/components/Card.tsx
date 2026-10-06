import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-hairline bg-surface ${className}`}
      style={{ boxShadow: "0 1px 2px rgba(11,11,11,0.04)" }}
    >
      {children}
    </section>
  );
}

export function CardHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-tight text-ink">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
