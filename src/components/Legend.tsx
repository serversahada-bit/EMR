export interface LegendItem {
  label: string;
  color: string;
  /** "line" untuk seri garis, "swatch" untuk area/batang. */
  shape?: "line" | "swatch";
}

/** Legend selalu hadir untuk ≥ 2 seri — identitas tidak pernah hanya dari warna. */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-xs text-ink-2">
          {item.shape === "line" ? (
            <span
              aria-hidden
              className="inline-block h-0.5 w-4 rounded-full"
              style={{ background: item.color }}
            />
          ) : (
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[3px]"
              style={{ background: item.color }}
            />
          )}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
