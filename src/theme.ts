import { useEffect } from 'react';
import type { BrandingColors, Course } from './types';

const VAR_NAMES: Record<keyof BrandingColors, string> = {
  navy: '--rd-navy',
  navyDeep: '--rd-navy-deep',
  gold: '--rd-gold',
  goldLight: '--rd-gold-light',
  cream: '--rd-cream',
  ink: '--rd-ink',
};

/** Convert "#0B1E3F" or "#0bf" into "11 30 63" so Tailwind can apply alpha. */
export function hexToRgbTriplet(hex: string): string | null {
  if (typeof hex !== 'string') return null;
  const v = hex.trim().replace(/^#/, '');
  const expanded = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Resolve a logo URL: absolute URLs pass through; relative paths get BASE_URL. */
export function resolveAssetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

/** Apply branding colours from course.json onto the document root. */
export function useApplyBranding(course: Course | null): void {
  useEffect(() => {
    const colors = course?.branding?.colors;
    if (!colors) return;
    const root = document.documentElement;
    const previous: { name: string; prev: string }[] = [];
    (Object.keys(VAR_NAMES) as (keyof BrandingColors)[]).forEach((key) => {
      const hex = colors[key];
      if (!hex) return;
      const rgb = hexToRgbTriplet(hex);
      if (!rgb) return;
      const name = VAR_NAMES[key];
      previous.push({ name, prev: root.style.getPropertyValue(name) });
      root.style.setProperty(name, rgb);
    });
    return () => {
      // Restore previous inline values on cleanup so unrelated re-renders don't
      // accumulate stale settings.
      for (const { name, prev } of previous) {
        if (prev) root.style.setProperty(name, prev);
        else root.style.removeProperty(name);
      }
    };
  }, [course?.branding?.colors]);
}
