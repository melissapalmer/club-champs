import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePlayersCsv } from '../csv/players';
import { parseScoresCsv } from '../csv/scores';
import { buildPlayerLines } from './engine';
import type { Course } from '../types';

const dataDir = resolve(__dirname, '../../public/data');
const course = JSON.parse(readFileSync(resolve(dataDir, 'course.json'), 'utf8')) as Course;
const players = parsePlayersCsv(readFileSync(resolve(dataDir, 'players.csv'), 'utf8'));
const scores = parseScoresCsv(readFileSync(resolve(dataDir, 'scores.csv'), 'utf8'));

// Spreadsheet's calculated values, copied from B Div / C Div (PH, Sat Gross, Sat Net,
// Sun Gross, Sun Net, Overall Gross, Overall Net) — extracted with data_only=True.
type Expected = {
  saId: string;
  ph: number;
  satG: number;
  satN: number;
  sunG: number;
  sunN: number;
  totG: number;
  totN: number;
};

const EXPECTED: Expected[] = [
  // B Div
  { saId: '2700149294', ph: 16, satG: 91, satN: 75, sunG: 95, sunN: 79, totG: 186, totN: 154 },
  { saId: '2700180851', ph: 15, satG: 97, satN: 82, sunG: 91, sunN: 76, totG: 188, totN: 158 },
  { saId: '2700333319', ph: 13, satG: 93, satN: 80, sunG: 93, sunN: 80, totG: 186, totN: 160 },
  { saId: '2700438384', ph: 2, satG: 72, satN: 70, sunG: 82, sunN: 80, totG: 154, totN: 150 },
  { saId: '2700227060', ph: 16, satG: 93, satN: 77, sunG: 88, sunN: 72, totG: 181, totN: 149 },
  // C Div
  { saId: '2700181092', ph: 28, satG: 107, satN: 79, sunG: 103, sunN: 75, totG: 210, totN: 154 },
  { saId: '2700181058', ph: 26, satG: 99, satN: 73, sunG: 109, sunN: 83, totG: 208, totN: 156 },
  { saId: '2700093097', ph: 36, satG: 115, satN: 79, sunG: 115, sunN: 79, totG: 230, totN: 158 },
  { saId: '2700191557', ph: 22, satG: 101, satN: 79, sunG: 105, sunN: 83, totG: 206, totN: 162 },
  { saId: '2700110837', ph: 25, satG: 102, satN: 77, sunG: 103, sunN: 78, totG: 205, totN: 155 },
  { saId: '2700223146', ph: 20, satG: 87, satN: 67, sunG: 95, sunN: 75, totG: 182, totN: 142 },
  { saId: '2700307743', ph: 20, satG: 90, satN: 70, sunG: 100.1, sunN: 80.1, totG: 190.1, totN: 150.1 },
  { saId: '2700290517', ph: 27, satG: 95, satN: 68, sunG: 103, sunN: 76, totG: 198, totN: 144 },
  { saId: '2700179246', ph: 20, satG: 103, satN: 83, sunG: 92, sunN: 72, totG: 195, totN: 155 },
  { saId: '2700116107', ph: 20, satG: 93, satN: 73, sunG: 94, sunN: 74, totG: 187, totN: 147 },
  { saId: '2700269173', ph: 22, satG: 95, satN: 73, sunG: 95, sunN: 73, totG: 190, totN: 146 },
];

describe('cross-check engine vs spreadsheet (full 2025 field)', () => {
  const lines = buildPlayerLines(players, scores, course);
  const bySa = new Map(lines.map((l) => [l.player.saId, l]));

  EXPECTED.forEach((e) => {
    const line = bySa.get(e.saId);
    it(`matches spreadsheet for saId ${e.saId} (${line?.player.firstName})`, () => {
      expect(line).toBeDefined();
      if (!line) return;
      expect(line.ph).toBe(e.ph);
      expect(line.sat.gross).toBeCloseTo(e.satG, 5);
      expect(line.sat.net).toBeCloseTo(e.satN, 5);
      expect(line.sun.gross).toBeCloseTo(e.sunG, 5);
      expect(line.sun.net).toBeCloseTo(e.sunN, 5);
      expect(line.overall.gross).toBeCloseTo(e.totG, 5);
      expect(line.overall.net).toBeCloseTo(e.totN, 5);
    });
  });
});
