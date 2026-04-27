import Papa from 'papaparse';
import type { Player } from '../types';

type PlayerRow = {
  firstName: string;
  lastName: string;
  saId: string;
  hi: string;
  division?: string;
};

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
    })),
    { columns: ['firstName', 'lastName', 'saId', 'hi', 'division'] }
  ) + '\n';
}
