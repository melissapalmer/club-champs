import { parseScoresCsv } from '../csv/scores';
import type { DayScore } from '../types';
import { fetchTab, postAction, type SheetsConfig } from './api';

const TAB = 'Scores';

export type ScoreRange = 'all' | 'front9' | 'back9';

export async function loadScores(sheetId: string): Promise<DayScore[]> {
  const csv = await fetchTab(sheetId, TAB);
  return parseScoresCsv(csv);
}

/**
 * Admin-only score upsert. Requires the full SheetsConfig (including secret).
 * Pass `range = 'front9' | 'back9'` to overwrite only that half of the round
 * — the other 9 holes on the existing row are preserved.
 */
export async function upsertScore(
  cfg: Pick<SheetsConfig, 'scriptUrl' | 'secret'>,
  score: DayScore,
  range: ScoreRange = 'all'
): Promise<void> {
  await postAction(cfg, {
    action: 'upsertScore',
    payload: {
      saId: score.saId,
      day: score.day,
      // The Apps Script expects an array of 18 entries; nulls become "".
      holes: score.holes.map((h) => (h == null ? '' : h)),
      range,
    },
  });
}

/**
 * Token-gated score submit (per-player magic link OR tent URL). The Apps
 * Script branch on `submitScore` skips the admin-secret check and verifies
 * the token against either the player's stored entryToken or the tent token.
 */
export async function submitScore(
  scriptUrl: string,
  token: string,
  score: DayScore,
  range: ScoreRange = 'all'
): Promise<void> {
  await postAction(
    // Pass an empty secret — Apps Script ignores it for submitScore.
    { scriptUrl, secret: '' },
    {
      action: 'submitScore',
      payload: {
        t: token,
        saId: score.saId,
        day: score.day,
        holes: score.holes.map((h) => (h == null ? '' : h)),
        range,
      },
    }
  );
}

/**
 * Batched group submit for the marker wizard. Verifies the deterministic
 * group token (a function of day+time+SHARED_SECRET) and writes all 4
 * players' partial scores in one round-trip.
 */
export async function submitScoreGroup(
  scriptUrl: string,
  token: string,
  group: { day: 1 | 2; time: string },
  scores: DayScore[],
  range: ScoreRange
): Promise<void> {
  await postAction(
    { scriptUrl, secret: '' },
    {
      action: 'submitScoreGroup',
      payload: {
        t: token,
        group: `${group.day}-${group.time}`,
        range,
        scores: scores.map((s) => ({
          saId: s.saId,
          day: s.day,
          holes: s.holes.map((h) => (h == null ? '' : h)),
        })),
      },
    }
  );
}
