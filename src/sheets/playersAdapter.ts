import { parsePlayersCsv } from '../csv/players';
import type { Player } from '../types';
import { fetchTab, postAction, type SheetsConfig } from './api';

const TAB = 'Players';

export async function loadPlayers(sheetId: string): Promise<Player[]> {
  const csv = await fetchTab(sheetId, TAB);
  return parsePlayersCsv(csv);
}

export async function upsertPlayer(
  cfg: Pick<SheetsConfig, 'scriptUrl' | 'secret'>,
  player: Player
): Promise<void> {
  await postAction(cfg, {
    action: 'upsertPlayer',
    payload: {
      firstName: player.firstName,
      lastName: player.lastName,
      saId: player.saId,
      hi: player.hi,
      division: player.divisionOverride ?? '',
    },
  });
}

export async function removePlayer(
  cfg: Pick<SheetsConfig, 'scriptUrl' | 'secret'>,
  saId: string
): Promise<void> {
  await postAction(cfg, {
    action: 'removePlayer',
    payload: { saId },
  });
}
