import Papa from 'papaparse';
import type { Course } from '../types';
import { fetchTab, postAction, type SheetsConfig } from './api';

const TAB = 'Course';

/**
 * The Course tab is a key/value table. Top-level scalars (club, event,
 * gender, maxHandicap, eclecticHandicapPct) are stored one per row for
 * easy editing in Sheets. Nested structures (tees, divisions, holes,
 * branding) are stored as JSON-encoded strings — they're set once and
 * rarely touched, and the JSON cells are still copy-pasteable.
 */
const SCALAR_KEYS = ['club', 'event', 'gender', 'maxHandicap', 'eclecticHandicapPct'] as const;
const JSON_KEYS = ['tees', 'divisions', 'holes', 'branding', 'countOut'] as const;

type Row = { key?: string; value?: string };

export async function loadCourse(sheetId: string): Promise<Course> {
  const csv = await fetchTab(sheetId, TAB);
  const parsed = Papa.parse<Row>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const map = new Map<string, string>();
  for (const row of parsed.data) {
    if (!row.key) continue;
    map.set(row.key.trim(), (row.value ?? '').toString());
  }

  const out: Record<string, unknown> = {};
  for (const k of SCALAR_KEYS) {
    const v = map.get(k);
    if (v == null) continue;
    if (k === 'maxHandicap' || k === 'eclecticHandicapPct') {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    } else {
      out[k] = v;
    }
  }
  for (const k of JSON_KEYS) {
    const v = map.get(k);
    if (!v) continue;
    try {
      out[k] = JSON.parse(v);
    } catch (e) {
      throw new Error(`Course tab: failed to parse JSON for "${k}": ${(e as Error).message}`);
    }
  }
  // Light schema check — the engine assumes these exist.
  for (const k of ['club', 'event', 'gender', 'tees', 'divisions', 'holes'] as const) {
    if (out[k] == null) {
      throw new Error(`Course tab is missing required key "${k}"`);
    }
  }
  return out as Course;
}

export function flattenCourse(course: Course): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const k of SCALAR_KEYS) {
    const v = (course as unknown as Record<string, unknown>)[k];
    if (v != null) out[k] = v as string | number;
  }
  for (const k of JSON_KEYS) {
    const v = (course as unknown as Record<string, unknown>)[k];
    if (v != null) out[k] = JSON.stringify(v);
  }
  return out;
}

export async function saveCourse(
  cfg: Pick<SheetsConfig, 'scriptUrl' | 'secret'>,
  course: Course
): Promise<void> {
  await postAction(cfg, {
    action: 'saveCourse',
    payload: flattenCourse(course),
  });
}
