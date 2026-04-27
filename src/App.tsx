import { useEffect } from 'react';
import { Route, Routes, useSearchParams } from 'react-router-dom';
import { ACCESS_KEY, setAdmin } from './admin';
import { Layout } from './components/Layout';
import { useAppData } from './data';
import { useApplyBranding } from './theme';
import { Config } from './routes/Config';
import { Eclectic } from './routes/Eclectic';
import { Enter } from './routes/Enter';
import { Leaderboard } from './routes/Leaderboard';
import { ManagePlayers } from './routes/ManagePlayers';
import { Players } from './routes/Players';
import { Results } from './routes/Results';

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

  useEffect(() => {
    if (!data?.course) return;
    const { club, event } = data.course;
    document.title = club && event ? `${club} — ${event}` : (event ?? club ?? 'Club Champs');
  }, [data?.course]);

  return (
    <Routes>
      <Route element={<Layout course={data?.course ?? null} />}>
        <Route
          path="/"
          element={
            error ? (
              <ErrorView message={error} />
            ) : data ? (
              <Leaderboard data={data} />
            ) : (
              <Loading />
            )
          }
        />
        <Route
          path="/eclectic"
          element={data ? <Eclectic data={data} /> : <Loading />}
        />
        <Route
          path="/results"
          element={data ? <Results data={data} /> : <Loading />}
        />
        <Route
          path="/players"
          element={data ? <Players data={data} /> : <Loading />}
        />
        <Route path="/enter" element={data ? <Enter data={data} /> : <Loading />} />
        <Route
          path="/manage-players"
          element={data ? <ManagePlayers data={data} /> : <Loading />}
        />
        <Route path="/config" element={data ? <Config data={data} /> : <Loading />} />
      </Route>
    </Routes>
  );
}

function Loading() {
  return <p className="text-rd-ink/60">Loading…</p>;
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="rd-card p-4 border border-red-200 bg-red-50">
      <h2 className="text-red-800 font-semibold mb-2">Couldn’t load data</h2>
      <pre className="text-sm text-red-900 whitespace-pre-wrap">{message}</pre>
    </div>
  );
}
