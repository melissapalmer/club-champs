/**
 * Renders a single hole score with the traditional scorecard symbol around it:
 *   • Solid circle with frame  — Albatross or better (-3 or less)
 *   • Solid circle             — Eagle (-2)
 *   • Open circle              — Birdie (-1)
 *   • No symbol                — Par
 *   • Open square              — Bogey (+1)
 *   • Solid square             — Double bogey (+2)
 *   • Solid square with frame  — Triple bogey or worse (+3 or more)
 */
export function ScoreSymbol({ score, par }: { score: number | null | undefined; par: number }) {
  if (score == null || !Number.isFinite(score)) {
    return <span className="text-rd-ink/40">·</span>;
  }
  const diff = score - par;

  // Inner element shows the score; outer wrapper provides the optional frame.
  const baseInner =
    'inline-flex items-center justify-center w-6 h-6 leading-none tabular-nums';
  let inner = baseInner;
  let outer = 'inline-flex items-center justify-center';
  let frame = false;

  if (diff <= -3) {
    inner += ' rounded-full bg-rd-navy text-white';
    frame = true;
  } else if (diff === -2) {
    inner += ' rounded-full bg-rd-navy text-white';
  } else if (diff === -1) {
    inner += ' rounded-full border-2 border-rd-navy';
  } else if (diff === 0) {
    inner += '';
  } else if (diff === 1) {
    inner += ' border-2 border-rd-navy';
  } else if (diff === 2) {
    inner += ' bg-rd-navy text-white';
  } else {
    // diff >= 3
    inner += ' bg-rd-navy text-white';
    frame = true;
  }

  if (frame) {
    // Outer ring just barely bigger than the inner shape; matches the "with frame"
    // convention seen on traditional scorecards. Kept tight so 18 cells fit on
    // narrower viewports.
    const isCircle = diff < 0;
    outer += ` p-px ${isCircle ? 'rounded-full' : ''} border border-rd-navy`;
  }

  return (
    <span className={outer}>
      <span className={inner}>{score}</span>
    </span>
  );
}
