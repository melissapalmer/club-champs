import type { PlayerStatCounts } from '../../scoring/stats';

/**
 * Resolve `rgb(<triplet>)` from a CSS custom property at runtime so chart
 * fills/strokes track the live branding from `theme.ts`. Falls back to a
 * Royal Durban hex if the variable isn't set (server-side or pre-paint).
 */
export function cssVarColor(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }
  const triplet = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${name}`)
    .trim();
  return triplet ? `rgb(${triplet})` : fallback;
}

/** Bucket colours keep the same identity across pies (so an Eagle is always
 *  navy regardless of which series the pie represents). */
export function bucketColors(): Record<keyof PlayerStatCounts, string> {
  return {
    eaglesPlus: cssVarColor('rd-navy', 'rgb(11 30 63)'),
    birdies: cssVarColor('rd-gold', 'rgb(184 137 58)'),
    pars: cssVarColor('rd-gold-light', 'rgb(212 168 89)'),
    bogeys: 'rgb(156 163 175)', // ink/40 equivalent — neutral grey for "ok"
    doubleBogeys: 'rgb(107 114 128)', // ink/60
    triplePlus: 'rgb(75 85 99)', // ink/80 — darkest grey for worst
  };
}

/**
 * Series colour rotation for distinguishing players / averages in the bar
 * and line charts. The first two pull from branding so the player and the
 * event-average always look "on brand"; later picks fall back to neutral
 * accents that don't clash.
 */
export function seriesColor(index: number): string {
  switch (index) {
    case 0:
      return cssVarColor('rd-navy', 'rgb(11 30 63)');
    case 1:
      return cssVarColor('rd-gold', 'rgb(184 137 58)');
    case 2:
      return 'rgb(13 148 136)'; // teal
    case 3:
      return 'rgb(190 24 93)'; // raspberry
    case 4:
      return 'rgb(124 58 237)'; // violet
    case 5:
      return 'rgb(217 119 6)'; // amber
    default:
      return 'rgb(75 85 99)';
  }
}
