import Papa from 'papaparse';
import type { TeeTime } from '../types';

type Row = { day?: string; time?: string; saId?: string; name?: string };

/**
 * Parse the TeeTimes Sheet tab.
 *
 * Schema: `day, time, saId, name`. The `name` column is a denormalised
 * snapshot written by the generator for human readability of the Sheet —
 * consumers (the website) prefer to look up the live name from `Players`
 * by saId so renames flow through without regenerating, but `name` is
 * preserved here as a fallback for missing-player rows.
 *
 * Defensive: silently drops rows with bad day or empty time/saId — a stale
 * stray row in the Sheet shouldn't break the whole page.
 */
export function parseTeeTimesCsv(text: string): TeeTime[] {
  const parsed = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const out: TeeTime[] = [];
  for (const row of parsed.data) {
    const day = Number(row.day);
    if (day !== 1 && day !== 2) continue;
    const time = (row.time ?? '').trim();
    const saId = (row.saId ?? '').trim();
    if (!time || !saId) continue;
    out.push({
      day: day as 1 | 2,
      time,
      saId,
      name: (row.name ?? '').trim(),
    });
  }
  return out;
}
