import { parseTeeTimesCsv } from '../csv/teeTimes';
import type { TeeTime } from '../types';
import { fetchTab, postAction, type SheetsConfig } from './api';

const TAB = 'TeeTimes';

/**
 * Read the TeeTimes tab. If the tab doesn't exist yet (admin hasn't
 * generated a draw, or hasn't enabled the feature), return [] rather
 * than throwing — the website should still render the rest of the
 * pages cleanly while showing an "empty draw" state on /tee-times.
 */
export async function loadTeeTimes(sheetId: string): Promise<TeeTime[]> {
  try {
    const csv = await fetchTab(sheetId, TAB);
    return parseTeeTimesCsv(csv);
  } catch {
    return [];
  }
}

export async function saveTeeTimes(
  cfg: Pick<SheetsConfig, 'scriptUrl' | 'secret'>,
  day: 1 | 2,
  rows: TeeTime[]
): Promise<void> {
  await postAction(cfg, {
    action: 'saveTeeTimes',
    payload: {
      day,
      rows: rows.map((r) => ({ time: r.time, saId: r.saId, name: r.name })),
    },
  });
}
