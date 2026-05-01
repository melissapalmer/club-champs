import { useCallback, useEffect, useRef, useState } from 'react';
import { loadCourse } from './sheets/courseAdapter';
import { loadPlayers } from './sheets/playersAdapter';
import { loadScores } from './sheets/scoresAdapter';
import { loadSheetIdForReads } from './sheets/settings';
import { loadTeeTimes } from './sheets/teeTimesAdapter';
import type { Course, DayScore, Player, TeeTime } from './types';

const POLL_MS = 15_000;

export type AppData = {
  course: Course;
  players: Player[];
  scores: DayScore[];
  teeTimes: TeeTime[];
  /** Force a fresh fetch (used after writes). */
  reload: () => Promise<void>;
};

async function fetchAll(sheetId: string): Promise<{
  course: Course;
  players: Player[];
  scores: DayScore[];
  teeTimes: TeeTime[];
}> {
  const [course, players, scores, teeTimes] = await Promise.all([
    loadCourse(sheetId),
    loadPlayers(sheetId),
    loadScores(sheetId),
    loadTeeTimes(sheetId),
  ]);
  return { course, players, scores, teeTimes };
}

/**
 * Cheap content fingerprint so we only re-render when something actually
 * changed. Counts are enough — every meaningful edit changes one of these
 * numbers OR the JSON of one record. Stringifying the lot is fine for
 * a 20-player field.
 */
function fingerprint(d: {
  course: Course;
  players: Player[];
  scores: DayScore[];
  teeTimes: TeeTime[];
}): string {
  return JSON.stringify([d.course, d.players, d.scores, d.teeTimes]);
}

export function useAppData(): { data: AppData | null; error: string | null } {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastPrintRef = useRef<string>('');
  const sheetIdRef = useRef<string | null>(null);

  // Resolve sheet id (and re-resolve on storage change so saving Settings
  // mid-session takes effect without a full reload).
  const [, forceReadSettings] = useState(0);
  useEffect(() => {
    const onChange = () => forceReadSettings((n) => n + 1);
    window.addEventListener('storage', onChange);
    window.addEventListener('rd-sheets-change', onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('rd-sheets-change', onChange);
    };
  }, []);
  sheetIdRef.current = loadSheetIdForReads();

  const reload = useCallback(async () => {
    const sheetId = loadSheetIdForReads();
    if (!sheetId) {
      setError(
        'No Google Sheet configured. Open Score Entry or Config to set the Sheet ID and Apps Script URL.'
      );
      return;
    }
    try {
      const next = await fetchAll(sheetId);
      const print = fingerprint(next);
      if (print !== lastPrintRef.current) {
        lastPrintRef.current = print;
        setData((prev) => ({
          ...next,
          reload: prev?.reload ?? reload,
        }));
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Poll every POLL_MS plus refetch on focus.
  useEffect(() => {
    void reload();
    const interval = window.setInterval(() => {
      void reload();
    }, POLL_MS);
    const onFocus = () => {
      void reload();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [reload]);

  // Make sure data.reload always points at the latest closure.
  useEffect(() => {
    setData((prev) => (prev ? { ...prev, reload } : prev));
  }, [reload]);

  return { data, error };
}
