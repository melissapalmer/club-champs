import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAppData } from './data';
import { Eclectic } from './routes/Eclectic';
import { Enter } from './routes/Enter';
import { Leaderboard } from './routes/Leaderboard';
import { Players } from './routes/Players';
import { Results } from './routes/Results';

export function App() {
  const { data, error } = useAppData();

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
