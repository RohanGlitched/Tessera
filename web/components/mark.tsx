/**
 * The mark: four tesserae, one of them gold.
 *
 * A basket is a mosaic and a mosaic is laid one tile at a time, so the mark is
 * literally four tiles with a grout line between them. The gold tile is the one
 * you chose; the other three are the rest of the market.
 */
export function Mark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <rect x="0" y="0" width="11" height="11" fill="var(--color-gold)" />
      <rect x="13" y="0" width="11" height="6" fill="currentColor" opacity="0.55" />
      <rect x="13" y="8" width="11" height="3" fill="currentColor" opacity="0.3" />
      <rect x="0" y="13" width="6" height="11" fill="currentColor" opacity="0.4" />
      <rect x="8" y="13" width="16" height="11" fill="currentColor" opacity="0.22" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Mark className="size-5 text-ivory" />
      <span className="display text-[1.35rem] tracking-[0.01em] text-ivory">
        Tessera
      </span>
    </span>
  );
}
