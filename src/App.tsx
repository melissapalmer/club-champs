import { useEffect, useState } from 'react';
import { Route, Routes, useSearchParams } from 'react-router-dom';
import { ACCESS_KEY, setAdmin, useIsAdmin } from './admin';
import { Layout } from './components/Layout';
import { SheetSettingsDialog } from './components/SheetSettingsDialog';
import { useAppData } from './data';
import { Config } from './routes/Config';
import { Eclectic } from './routes/Eclectic';
import { Enter } from './routes/Enter';
import { Leaderboard } from './routes/Leaderboard';
import { ManagePlayers } from './routes/ManagePlayers';
import { Players } from './routes/Players';
import { Results } from './routes/Results';
import { TeeTimes } from './routes/TeeTimes';
import { loadSheetsSettings } from './sheets/settings';
import { useApplyBranding } from './theme';

function useAccessKeyParam(): void {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    let consumed = false;

    // Case 1: ?key=… inside the routed (post-hash) query.
    if (searchParams.get('key') === ACCESS_KEY) {
      setAdmin(true);
      const next = new URLSearchParams(searchParams);
      next.delete('key');
      setSearchParams(next, { replace: true });
      consumed = true;
    }

    // Case 2: ?key=… on the document URL (before the hash) — handy for
    // pasting "https://…/club-champs/?key=durban2026" without the hash route.
    const docParams = new URLSearchParams(window.location.search);
    if (docParams.get('key') === ACCESS_KEY) {
      setAdmin(true);
      docParams.delete('key');
      const search = docParams.toString() ? `?${docParams.toString()}` : '';
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${search}${window.location.hash}`
      );
      consumed = true;
    }

    void consumed;
  }, [searchParams, setSearchParams]);
}

export function App() {
  const { data, error } = useAppData();
  useApplyBranding(data?.course ?? null);
  useAccessKeyParam();
  const admin = useIsAdmin();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!data?.course) return;
    const { club, event } = data.course;
    document.title = club && event ? `${club} — ${event}` : (event ?? club ?? 'Club Champs');
  }, [data?.course]);

  // Block-level state shared by every route: still loading, or no data
  // because the Sheet isn't configured yet. We render the layout shell so
  // the navy header + nav still appear; the inner area carries the message.
  const blocker = (() => {
    if (data) return null;
    if (error) return <DataError message={error} admin={admin} onConfigure={() => setShowSettings(true)} />;
    return <Loading />;
  })();

  return (
    <>
      <Routes>
        <Route element={<Layout course={data?.course ?? null} teeTimes={data?.teeTimes ?? []} />}>
          <Route path="/" element={blocker ?? <Leaderboard data={data!} />} />
          <Route path="/eclectic" element={blocker ?? <Eclectic data={data!} />} />
          <Route path="/results" element={blocker ?? <Results data={data!} />} />
          <Route path="/tee-times" element={blocker ?? <TeeTimes data={data!} />} />
          <Route path="/players" element={blocker ?? <Players data={data!} />} />
          <Route path="/enter" element={blocker ?? <Enter data={data!} />} />
          <Route path="/manage-players" element={blocker ?? <ManagePlayers data={data!} />} />
          <Route path="/config" element={blocker ?? <Config data={data!} />} />
        </Route>
      </Routes>

      {showSettings && (
        <SheetSettingsDialog
          initial={loadSheetsSettings()}
          onSaved={() => setShowSettings(false)}
          onCancel={() => setShowSettings(false)}
        />
      )}
    </>
  );
}

function Loading() {
  return <p className="text-rd-ink/60">Loading…</p>;
}

function DataError({
  message,
  admin,
  onConfigure,
}: {
  message: string;
  admin: boolean;
  onConfigure: () => void;
}) {
  const looksUnconfigured = /no google sheet configured/i.test(message);
  return (
    <div className="rd-card p-4 border border-red-200 bg-red-50">
      <h2 className="text-red-800 font-semibold mb-2">
        {looksUnconfigured ? 'Site not configured yet' : 'Couldn’t load data'}
      </h2>
      <p className="text-sm text-red-900 whitespace-pre-wrap mb-3">{message}</p>
      {admin && (
        <button
          className="px-3 py-1.5 text-sm rounded bg-rd-navy text-white"
          onClick={onConfigure}
        >
          Configure Google Sheet
        </button>
      )}
    </div>
  );
}
