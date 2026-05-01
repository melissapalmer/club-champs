import Papa from 'papaparse';
import type { DivisionCode, Match } from '../types';

type Row = {
  id?: string;
  divisionCode?: string;
  round?: string;
  slot?: string;
  playerASaId?: string;
  playerBSaId?: string;
  winnerSaId?: string;
  result?: string;
};

/**
 * Parse the Matches Sheet tab.
 *
 * Schema: `id, divisionCode, round, slot, playerASaId, playerBSaId, winnerSaId, result`.
 *
 * Defensive: drops rows with missing id, missing/invalid divisionCode, or
 * non-numeric round/slot. Empty playerA/B/winner/result are normal — they
 * exist for unresolved matches in rounds 2+.
 */
export function parseMatchesCsv(text: string): Match[] {
  const parsed = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const out: Match[] = [];
  for (const row of parsed.data) {
    const id = (row.id ?? '').trim();
    const divisionCode = (row.divisionCode ?? '').trim().toUpperCase();
    const round = Number(row.round);
    const slot = Number(row.slot);
    if (!id) continue;
    if (
      divisionCode !== 'A' &&
      divisionCode !== 'B' &&
      divisionCode !== 'C' &&
      divisionCode !== 'D'
    ) {
      continue;
    }
    if (!Number.isInteger(round) || round < 1) continue;
    if (!Number.isInteger(slot) || slot < 0) continue;
    const m: Match = {
      id,
      divisionCode: divisionCode as DivisionCode,
      round,
      slot,
    };
    const a = (row.playerASaId ?? '').trim();
    const b = (row.playerBSaId ?? '').trim();
    const w = (row.winnerSaId ?? '').trim();
    const r = (row.result ?? '').trim();
    if (a) m.playerASaId = a;
    if (b) m.playerBSaId = b;
    if (w) m.winnerSaId = w;
    if (r) m.result = r;
    out.push(m);
  }
  return out;
}
