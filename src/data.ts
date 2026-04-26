import { useEffect, useState } from 'react';
import { parsePlayersCsv } from './csv/players';
import { parseScoresCsv } from './csv/scores';
import type { Course, DayScore, Player } from './types';

const dataPath = (file: string) =>
  // Vite serves public/ at the base URL ("./" in our config).
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/${file}?t=${Date.now()}`;

async function fetchText(file: string): Promise<string> {
  const res = await fetch(dataPath(file), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return res.text();
}

export async function loadCourse(): Promise<Course> {
  return JSON.parse(await fetchText('course.json'));
}

export async function loadPlayers(): Promise<Player[]> {
  return parsePlayersCsv(await fetchText('players.csv'));
}

export async function loadScores(): Promise<DayScore[]> {
  return parseScoresCsv(await fetchText('scores.csv'));
}

export type AppData = {
  course: Course;
  players: Player[];
  scores: DayScore[];
  reload: () => Promise<void>;
};

export function useAppData(): { data: AppData | null; error: string | null } {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [course, players, scores] = await Promise.all([
        loadCourse(),
        loadPlayers(),
        loadScores(),
      ]);
      setData((prev) => ({
        course,
        players,
        scores,
        reload: prev?.reload ?? load,
      }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return { data, error };
}
