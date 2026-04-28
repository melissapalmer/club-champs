import { parseScoresCsv } from '../csv/scores';
import type { DayScore } from '../types';
import { fetchTab, postAction, type SheetsConfig } from './api';

const TAB = 'Scores';

export async function loadScores(sheetId: string): Promise<DayScore[]> {
  const csv = await fetchTab(sheetId, TAB);
  return parseScoresCsv(csv);
}

export async function upsertScore(
  cfg: Pick<SheetsConfig, 'scriptUrl' | 'secret'>,
  score: DayScore
): Promise<void> {
  await postAction(cfg, {
    action: 'upsertScore',
    payload: {
      saId: score.saId,
      day: score.day,
      // The Apps Script expects an array of 18 entries; nulls become "".
      holes: score.holes.map((h) => (h == null ? '' : h)),
    },
  });
}
