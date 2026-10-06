/**
 * Meter: satu rasio terhadap batas. Track adalah langkah lebih terang
 * dari ramp yang sama, isian membawa tingkat keparahan.
 */
export function Meter({
  ratio,
  label,
  valueLabel,
}: {
  /** Persen pencapaian; 100 = tepat target. */
  ratio: number;
  label?: string;
  valueLabel?: string;
}) {
  const clamped = Math.max(0, Math.min(ratio, 125));
  const fill =
    ratio >= 100
      ? "var(--s1)"
      : ratio >= 95
        ? "var(--seq-350)"
        : ratio >= 85
          ? "var(--warning)"
          : "var(--critical)";

  return (
    <div>
      {label || valueLabel ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label ? <span className="text-xs text-ink-2">{label}</span> : null}
          {valueLabel ? (
            <span className="tnum text-xs font-semibold text-ink">
              {valueLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className="relative h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--seq-100)" }}
        role="img"
        aria-label={`${label ?? "Pencapaian"}: ${ratio.toFixed(1)} persen dari target`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${(clamped / 125) * 100}%`, background: fill }}
        />
      </div>
    </div>
  );
}
