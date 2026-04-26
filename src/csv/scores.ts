import Papa from 'papaparse';
import type { DayScore } from '../types';

const HOLE_COLS = Array.from({ length: 18 }, (_, i) => `h${i + 1}`);
const COLUMNS = ['saId', 'day', ...HOLE_COLS];

type Row = Record<string, string>;

export function parseScoresCsv(text: string): DayScore[] {
  const result = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return result.data
    .filter((row) => row.saId && row.day)
    .map((row) => {
      const day = Number(row.day);
      if (day !== 1 && day !== 2) {
        throw new Error(`Invalid day "${row.day}" for ${row.saId}`);
      }
      const holes: (number | null)[] = HOLE_COLS.map((c) => {
        const v = row[c]?.trim();
        if (!v) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      });
      return { saId: row.saId.trim(), day: day as 1 | 2, holes };
    });
}

export function serialiseScoresCsv(scores: DayScore[]): string {
  const rows = scores.map((s) => {
    const out: Row = { saId: s.saId, day: String(s.day) };
    HOLE_COLS.forEach((c, i) => {
      out[c] = s.holes[i] == null ? '' : String(s.holes[i]);
    });
    return out;
  });
  return Papa.unparse(rows, { columns: COLUMNS }) + '\n';
}

export function upsertScore(scores: DayScore[], updated: DayScore): DayScore[] {
  const next = scores.filter((s) => !(s.saId === updated.saId && s.day === updated.day));
  next.push(updated);
  next.sort((a, b) => (a.saId === b.saId ? a.day - b.day : a.saId.localeCompare(b.saId)));
  return next;
}
