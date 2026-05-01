import { parseMatchesCsv } from '../csv/matches';
import type { Match } from '../types';
import { fetchTab, postAction, type SheetsConfig } from './api';

const TAB = 'Matches';

/**
 * Read the Matches tab. If the tab doesn't exist yet (admin hasn't generated
 * a bracket), return [] rather than throwing — the website should still
 * render the rest of the pages cleanly while showing an empty Match Play state.
 */
export async function loadMatches(sheetId: string): Promise<Match[]> {
  try {
    const csv = await fetchTab(sheetId, TAB);
    return parseMatchesCsv(csv);
  } catch {
    return [];
  }
}

/**
 * Bulk replace the entire Matches tab. Used both for Generate (writing the
 * fresh bracket) and per-result save (writing the propagated array).
 * At ≤32 rows this is cheaper than per-row upsert and keeps the bracket
 * consistent across rounds atomically.
 */
export async function saveMatches(
  cfg: Pick<SheetsConfig, 'scriptUrl' | 'secret'>,
  matches: Match[]
): Promise<void> {
  await postAction(cfg, {
    action: 'saveMatches',
    payload: {
      rows: matches.map((m) => ({
        id: m.id,
        round: m.round,
        slot: m.slot,
        playerASaId: m.playerASaId ?? '',
        playerBSaId: m.playerBSaId ?? '',
        winnerSaId: m.winnerSaId ?? '',
        result: m.result ?? '',
      })),
    },
  });
}

/** Wipe the Matches tab data rows; keeps the header. Used by the Reset button. */
export async function clearMatches(
  cfg: Pick<SheetsConfig, 'scriptUrl' | 'secret'>
): Promise<void> {
  await postAction(cfg, { action: 'clearMatches', payload: {} });
}
