import { useEffect, useState } from 'react';
import { useIsAdmin } from '../admin';
import { GitHubSettingsDialog } from '../components/GitHubSettingsDialog';
import type { AppData } from '../data';
import {
  commitFile,
  loadGitHubSettings,
  saveGitHubSettings,
  type GitHubSettings,
} from '../github';
import type { Course, DivisionConfig } from '../types';

const TEE_KEYS = ['yellow', 'white', 'blue', 'red'] as const;

function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function NumField({
  label,
  value,
  step = 1,
  onChange,
  className = '',
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-rd-ink/60 block">{label}</span>
      <input
        type="number"
        step={step}
        className="w-full border rounded px-2 py-1 mt-0.5 tabular-nums"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-rd-ink/60 block">{label}</span>
      <input
        type="text"
        className="w-full border rounded px-2 py-1 mt-0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function Config({ data }: { data: AppData }) {
  const admin = useIsAdmin();
  const [draft, setDraft] = useState<Course>(() => structuredClone(data.course));
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'err'; msg?: string }>({
    kind: 'idle',
  });
  const [gh, setGh] = useState<GitHubSettings | null>(loadGitHubSettings());
  const [showSettings, setShowSettings] = useState(false);

  // Reset the draft if the underlying data refreshes (e.g. after a save).
  useEffect(() => {
    setDraft(structuredClone(data.course));
  }, [data.course]);

  if (!admin) {
    return (
      <section>
        <h1 className="text-2xl text-rd-navy mb-2">Not available</h1>
        <p className="text-sm text-rd-ink/70">Config is admin-only.</p>
      </section>
    );
  }

  const updateTee = (key: typeof TEE_KEYS[number], field: 'par' | 'cr' | 'slope', v: number) => {
    setDraft((d) => ({ ...d, tees: { ...d.tees, [key]: { ...d.tees[key], [field]: v } } }));
  };

  const updateDivision = (idx: number, patch: Partial<DivisionConfig>) => {
    setDraft((d) => ({
      ...d,
      divisions: d.divisions.map((div, i) => (i === idx ? { ...div, ...patch } : div)),
    }));
  };

  const onSave = async () => {
    const json = JSON.stringify(draft, null, 2) + '\n';
    if (!gh) {
      downloadJson('course.json', json);
      setStatus({
        kind: 'ok',
        msg: 'No GitHub token configured. Downloaded course.json — commit it manually.',
      });
      return;
    }
    setStatus({ kind: 'busy', msg: 'Committing…' });
    try {
      await commitFile(gh, 'public/data/course.json', json, 'Config: update course/divisions');
      setStatus({ kind: 'ok', msg: 'Committed. Pages will rebuild in ~30s.' });
      await data.reload();
    } catch (e) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : String(e) });
    }
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(data.course);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl text-rd-navy mb-1">Config</h1>
          <p className="text-sm text-rd-ink/60">
            Edit course rules and division settings. Saving commits{' '}
            <code>public/data/course.json</code> via the configured GitHub token.
          </p>
        </div>
        <button
          className="text-sm text-rd-navy hover:underline whitespace-nowrap"
          onClick={() => setShowSettings(true)}
        >
          {gh ? 'GitHub: configured' : 'Configure GitHub token'}
        </button>
      </div>

      <div className="rd-card p-4 space-y-3">
        <h2 className="text-lg text-rd-navy font-serif">Event</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField
            label="Club"
            value={draft.club}
            onChange={(v) => setDraft((d) => ({ ...d, club: v }))}
          />
          <TextField
            label="Event"
            value={draft.event}
            onChange={(v) => setDraft((d) => ({ ...d, event: v }))}
          />
          <label className="block">
            <span className="text-xs text-rd-ink/60 block">Gender</span>
            <select
              className="w-full border rounded px-2 py-1 mt-0.5"
              value={draft.gender}
              onChange={(e) =>
                setDraft((d) => ({ ...d, gender: e.target.value as Course['gender'] }))
              }
            >
              <option value="women">Women</option>
              <option value="men">Men</option>
            </select>
          </label>
          <NumField
            label="Max handicap"
            value={draft.maxHandicap}
            onChange={(v) => setDraft((d) => ({ ...d, maxHandicap: v }))}
          />
          <NumField
            label="Eclectic % of PH"
            value={draft.eclecticHandicapPct}
            onChange={(v) => setDraft((d) => ({ ...d, eclecticHandicapPct: v }))}
          />
        </div>
      </div>

      <div className="rd-card p-4">
        <h2 className="text-lg text-rd-navy font-serif mb-3">Tees</h2>
        <div className="overflow-x-auto">
          <table className="rd-table table-fixed">
            <colgroup>
              <col style={{ width: '20%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '27%' }} />
              <col style={{ width: '27%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Tee</th>
                <th>Par</th>
                <th>CR</th>
                <th>Slope</th>
              </tr>
            </thead>
            <tbody>
              {TEE_KEYS.map((k) => {
                const t = draft.tees[k];
                return (
                  <tr key={k}>
                    <td className="capitalize">{k}</td>
                    <td>
                      <NumField label="" value={t.par} onChange={(v) => updateTee(k, 'par', v)} />
                    </td>
                    <td>
                      <NumField
                        label=""
                        step={0.1}
                        value={t.cr}
                        onChange={(v) => updateTee(k, 'cr', v)}
                      />
                    </td>
                    <td>
                      <NumField
                        label=""
                        value={t.slope}
                        onChange={(v) => updateTee(k, 'slope', v)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rd-card p-4">
        <h2 className="text-lg text-rd-navy font-serif mb-3">Divisions</h2>
        <div className="space-y-3">
          {draft.divisions.map((div, idx) => (
            <div
              key={div.code}
              className="border border-rd-cream rounded p-3 grid grid-cols-2 sm:grid-cols-6 gap-3"
            >
              <div className="col-span-2 sm:col-span-1">
                <span className="text-xs text-rd-ink/60 block">Code</span>
                <div className="font-semibold mt-0.5">{div.code}</div>
              </div>
              <TextField
                label="Name"
                value={div.name}
                onChange={(v) => updateDivision(idx, { name: v })}
                className="col-span-2 sm:col-span-1"
              />
              <label className="block">
                <span className="text-xs text-rd-ink/60 block">Tee</span>
                <select
                  className="w-full border rounded px-2 py-1 mt-0.5 capitalize"
                  value={div.tee}
                  onChange={(e) =>
                    updateDivision(idx, { tee: e.target.value as DivisionConfig['tee'] })
                  }
                >
                  {TEE_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <NumField
                label="HI min"
                step={0.1}
                value={div.hiMin}
                onChange={(v) => updateDivision(idx, { hiMin: v })}
              />
              <NumField
                label="HI max"
                step={0.1}
                value={div.hiMax}
                onChange={(v) => updateDivision(idx, { hiMax: v })}
              />
              <NumField
                label="Handicap %"
                value={div.handicapPct}
                onChange={(v) => updateDivision(idx, { handicapPct: v })}
              />
              <label className="flex items-center gap-2 col-span-2 sm:col-span-6">
                <input
                  type="checkbox"
                  checked={!!div.hidden}
                  onChange={(e) => updateDivision(idx, { hidden: e.target.checked })}
                />
                <span className="text-sm">
                  Hidden — skip this division everywhere (Players, Scores, Eclectic, Results)
                </span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          className="px-4 py-2 bg-rd-navy text-white rounded font-medium disabled:opacity-50"
          disabled={!isDirty || status.kind === 'busy'}
          onClick={() => void onSave()}
        >
          {status.kind === 'busy' ? 'Saving…' : 'Save changes'}
        </button>
        <button
          className="px-3 py-2 text-sm border border-rd-cream rounded disabled:opacity-50"
          disabled={!isDirty || status.kind === 'busy'}
          onClick={() => setDraft(structuredClone(data.course))}
        >
          Discard
        </button>
        {status.msg && (
          <span
            className={`text-sm ${
              status.kind === 'err'
                ? 'text-red-700'
                : status.kind === 'ok'
                  ? 'text-green-700'
                  : 'text-rd-ink/70'
            }`}
          >
            {status.msg}
          </span>
        )}
      </div>

      {showSettings && (
        <GitHubSettingsDialog
          initial={gh}
          onSave={(s) => {
            saveGitHubSettings(s);
            setGh(s);
            setShowSettings(false);
          }}
          onCancel={() => {
            setGh(loadGitHubSettings());
            setShowSettings(false);
          }}
        />
      )}
    </section>
  );
}
