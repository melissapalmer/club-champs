import Papa from 'papaparse';
import type { Player } from '../types';

type PlayerRow = {
  firstName: string;
  lastName: string;
  saId: string;
  hi: string;
  division?: string;
  matchPlay?: string;
};

/**
 * Tri-state parser for the matchPlay column. Returns:
 *   - `false` only when the cell is explicitly FALSE/N/NO/0 (opted out)
 *   - `true` when the cell is TRUE/Y/YES/1 (explicitly opted in)
 *   - `undefined` when the cell is empty / missing — treated as the
 *     default "opted in" elsewhere in the app, but stored as absence.
 *
 * Default-opt-in semantics: a fresh roster on a Sheet without the
 * matchPlay column reads as everyone opted in.
 */
function parseMatchPlay(v: string | undefined): boolean | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  if (s === 'true' || s === 'y' || s === 'yes' || s === '1') return true;
  if (s === 'false' || s === 'n' || s === 'no' || s === '0') return false;
  return undefined;
}

export function parsePlayersCsv(text: string): Player[] {
  const result = Papa.parse<PlayerRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return result.data
    .filter((row) => row.saId && row.firstName)
    .map((row) => {
      const player: Player = {
        firstName: row.firstName.trim(),
        lastName: row.lastName.trim(),
        saId: row.saId.trim(),
        hi: Number(row.hi),
      };
      const div = row.division?.trim().toUpperCase();
      if (div === 'A' || div === 'B' || div === 'C' || div === 'D') {
        player.divisionOverride = div;
      }
      const mp = parseMatchPlay(row.matchPlay);
      if (mp !== undefined) {
        player.matchPlay = mp;
      }
      return player;
    });
}

export function serialisePlayersCsv(players: Player[]): string {
  return Papa.unparse(
    players.map((p) => ({
      firstName: p.firstName,
      lastName: p.lastName,
      saId: p.saId,
      hi: p.hi,
      division: p.divisionOverride ?? '',
      matchPlay: p.matchPlay === true ? 'TRUE' : p.matchPlay === false ? 'FALSE' : '',
    })),
    { columns: ['firstName', 'lastName', 'saId', 'hi', 'division', 'matchPlay'] }
  ) + '\n';
}
