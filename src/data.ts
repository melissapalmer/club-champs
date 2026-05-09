import { useCallback, useEffect, useRef, useState } from 'react';
import { loadCourse } from './sheets/courseAdapter';
import { loadMatches } from './sheets/matchesAdapter';
import { loadPlayers } from './sheets/playersAdapter';
import { loadScores } from './sheets/scoresAdapter';
import { loadSheetIdForReads } from './sheets/settings';
import { loadTeeTimes } from './sheets/teeTimesAdapter';
import type { Course, DayScore, Match, Player, TeeTime } from './types';

const POLL_MS = 15_000;

export type AppData = {
  course: Course;
  players: Player[];
  scores: DayScore[];
  teeTimes: TeeTime[];
  matches: Match[];
  /** Wall-clock time of the last *content* change (not the last poll). */
  lastChanged: Date;
  /** Force a fresh fetch (used after writes). */
  reload: () => Promise<void>;
  /**
   * Optimistically merge a freshly-saved score into local state so the
   * leaderboards update on the same tick as the save, without waiting for
   * the gviz read to return fresh CSV. The next `reload()` call replaces
   * this with the canonical server state.
   */
  applyScore: (score: DayScore) => void;
};

async function fetchAll(sheetId: string): Promise<{
  course: Course;
  players: Player[];
  scores: DayScore[];
  teeTimes: TeeTime[];
  matches: Match[];
}> {
  const [course, players, scores, teeTimes, matches] = await Promise.all([
    loadCourse(sheetId),
    loadPlayers(sheetId),
    loadScores(sheetId),
    loadTeeTimes(sheetId),
    loadMatches(sheetId),
  ]);
  return { course, players, scores, teeTimes, matches };
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
  matches: Match[];
}): string {
  return JSON.stringify([d.course, d.players, d.scores, d.teeTimes, d.matches]);
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
        const lastChanged = new Date();
        setData((prev) => ({
          ...next,
          lastChanged,
          reload: prev?.reload ?? reload,
          applyScore: prev?.applyScore ?? (() => {}),
        }));
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Optimistic local merge so the UI reflects a save before the server-side
  // CSV catches up. Replaces the matching (saId, day) row or appends.
  const applyScore = useCallback((score: DayScore) => {
    setData((prev) => {
      if (!prev) return prev;
      const idx = prev.scores.findIndex(
        (s) => s.saId === score.saId && s.day === score.day
      );
      const nextScores =
        idx >= 0
          ? prev.scores.map((s, i) => (i === idx ? score : s))
          : [...prev.scores, score];
      // Reset the fingerprint so the next reload's diff against the server
      // is treated as a real change (otherwise our local merge could collide
      // with a stale server fingerprint and skip the setData call).
      lastPrintRef.current = '';
      return { ...prev, scores: nextScores, lastChanged: new Date() };
    });
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

  // Make sure data.reload / applyScore always point at the latest closure.
  useEffect(() => {
    setData((prev) => (prev ? { ...prev, reload, applyScore } : prev));
  }, [reload, applyScore]);

  return { data, error };
}
