import { useEffect, useState } from 'react';
import { useIsAdmin } from '../admin';
import { SheetSettingsDialog } from '../components/SheetSettingsDialog';
import type { AppData } from '../data';
import {
  DEFAULT_TOP_N,
  defaultAwards,
  PRIZE_CATEGORIES,
  PRIZE_LABELS,
} from '../prizes';
import { DEFAULT_COUNT_OUT_STEPS } from '../scoring/engine';
import { saveCourse } from '../sheets/courseAdapter';
import { loadSheetsSettings, type SheetsSettings } from '../sheets/settings';
import { resolveAssetUrl } from '../theme';
import type {
  Branding,
  BrandingColors,
  CountOutConfig,
  CountOutSegment,
  Course,
  DivisionCode,
  DivisionConfig,
  PrizeAward,
  PrizeCategory,
  PrizeConfig,
} from '../types';

const COLOR_KEYS: { key: keyof BrandingColors; label: string; fallback: string }[] = [
  { key: 'navy', label: 'Primary (navy)', fallback: '#0B1E3F' },
  { key: 'navyDeep', label: 'Primary darker', fallback: '#06142D' },
  { key: 'gold', label: 'Accent (gold)', fallback: '#B8893A' },
  { key: 'goldLight', label: 'Accent lighter', fallback: '#D4A859' },
  { key: 'cream', label: 'Background', fallback: '#F6F2EA' },
  { key: 'ink', label: 'Body text', fallback: '#1F2937' },
];

const TEE_KEYS = ['yellow', 'white', 'blue', 'red'] as const;

function NumField({
  label,
  value,
  onChange,
  className = '',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  // Local string state so the user can clear the field and retype freely
  // without each keystroke snapping back to the parsed parent value.
  const [text, setText] = useState<string>(() =>
    Number.isFinite(value) ? String(value) : ''
  );

  useEffect(() => {
    if (Number(text) !== value) {
      setText(Number.isFinite(value) ? String(value) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label className={`block ${className}`}>
      {label && <span className="text-xs text-rd-ink/60 block">{label}</span>}
      <input
        type="text"
        inputMode="decimal"
        className={`w-full border rounded px-2 py-1 tabular-nums ${label ? 'mt-0.5' : ''}`}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (v === '' || v === '-' || v === '.' || v === '-.') return;
          const n = Number(v);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => {
          if (text === '' || !Number.isFinite(Number(text))) {
            setText(Number.isFinite(value) ? String(value) : '');
          }
        }}
      />
    </label>
  );
}

function BrandingEditor({
  branding,
  onChange,
}: {
  branding: Branding | undefined;
  onChange: (b: Branding) => void;
}) {
  const colors = branding?.colors ?? {};
  const setLogo = (logoUrl: string) => onChange({ ...branding, logoUrl });
  const setColor = (key: keyof BrandingColors, value: string) =>
    onChange({ ...branding, colors: { ...colors, [key]: value } });
  const previewSrc = resolveAssetUrl(branding?.logoUrl);

  return (
    <div className="rd-card p-4 space-y-3">
      <div>
        <h2 className="text-lg text-rd-navy font-serif">Branding</h2>
        <p className="text-xs text-rd-ink/60 mt-1">
          Use a fully-qualified URL (e.g. <code>https://…/logo.png</code>) or the
          name of a file you've placed in <code>public/</code>
          (e.g. <code>my-club-logo.png</code>). Colours apply live across the site.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <TextField
          label="Logo URL"
          value={branding?.logoUrl ?? ''}
          onChange={setLogo}
        />
        <div className="bg-rd-navy rounded p-2 inline-flex items-center justify-center">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt="Logo preview"
              className="h-12 w-auto"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xs text-white/60 px-3 py-3">no logo</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {COLOR_KEYS.map(({ key, label, fallback }) => {
          const v = colors[key] ?? fallback;
          return (
            <label key={key} className="block">
              <span className="text-xs text-rd-ink/60 block">{label}</span>
              <span className="flex items-center gap-2 mt-0.5">
                <input
                  type="color"
                  className="h-8 w-10 border rounded p-0.5 bg-white shrink-0"
                  value={v}
                  onChange={(e) => setColor(key, e.target.value)}
                />
                <input
                  type="text"
                  className="w-full border rounded px-2 py-1 font-mono text-xs"
                  value={v}
                  onChange={(e) => setColor(key, e.target.value)}
                />
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

const COUNT_OUT_LABELS: Record<CountOutSegment, string> = {
  'back-9': 'Back 9 (holes 10–18)',
  'back-6': 'Back 6 (holes 13–18)',
  'back-3': 'Back 3 (holes 16–18)',
};

function CountOutEditor({
  countOut,
  onChange,
}: {
  countOut: CountOutConfig | undefined;
  onChange: (co: CountOutConfig) => void;
}) {
  const enabled = !!countOut?.enabled;
  const steps = countOut?.steps ?? DEFAULT_COUNT_OUT_STEPS;

  const setEnabled = (v: boolean) => onChange({ enabled: v, steps });
  const setFraction = (segment: CountOutSegment, fraction: number) => {
    onChange({
      enabled,
      steps: steps.map((s) => (s.segment === segment ? { ...s, netHandicapFraction: fraction } : s)),
    });
  };
  const resetDefaults = () => onChange({ enabled, steps: DEFAULT_COUNT_OUT_STEPS });

  return (
    <div className="rd-card p-4 space-y-3">
      <div>
        <h2 className="text-lg text-rd-navy font-serif">Count-out (tie-breakers)</h2>
        <p className="text-xs text-rd-ink/60 mt-1">
          When two players share a score, count-out picks the prize winner by comparing
          back-9, then back-6, then back-3. The position number stays tied (e.g. T1 / T1) —
          the count-out winner gets a small <code>c/o</code> badge next to their name. For
          net rankings, a fraction of the player's playing handicap is subtracted from each
          segment before comparing (standard: ½, ⅓, ⅙).
        </p>
      </div>

      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span className="text-sm">Enable count-out tie-breaking</span>
      </label>

      <div
        className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}
      >
        {steps.map((step) => (
          <NumField
            key={step.segment}
            label={`${COUNT_OUT_LABELS[step.segment]} — net HC fraction`}
            value={step.netHandicapFraction}
            onChange={(v) => setFraction(step.segment, v)}
          />
        ))}
      </div>

      <div className="text-xs">
        <button
          type="button"
          className="text-rd-navy hover:underline disabled:opacity-40"
          onClick={resetDefaults}
        >
          Reset to standard fractions (½, ⅓, ⅙)
        </button>
      </div>
    </div>
  );
}

function PrizesEditor({
  prizes,
  onChange,
}: {
  prizes: PrizeConfig | undefined;
  onChange: (p: PrizeConfig) => void;
}) {
  const awards = prizes?.awards ?? defaultAwards();
  const enabled = new Map<PrizeCategory, number>(awards.map((a) => [a.category, a.topN]));

  const setAwards = (next: PrizeAward[]) => {
    // Keep awards in canonical category order.
    const ordered = PRIZE_CATEGORIES.flatMap((c) => {
      const found = next.find((a) => a.category === c);
      return found ? [found] : [];
    });
    onChange({ awards: ordered });
  };

  const toggle = (cat: PrizeCategory) => {
    if (enabled.has(cat)) {
      enabled.delete(cat);
    } else {
      enabled.set(cat, DEFAULT_TOP_N);
    }
    setAwards(Array.from(enabled, ([category, topN]) => ({ category, topN })));
  };

  const setTopN = (cat: PrizeCategory, n: number) => {
    if (!enabled.has(cat) || !(n >= 1)) return;
    enabled.set(cat, n);
    setAwards(Array.from(enabled, ([category, topN]) => ({ category, topN })));
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Prizes</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {PRIZE_CATEGORIES.map((cat) => {
          const isOn = enabled.has(cat);
          const top = enabled.get(cat) ?? DEFAULT_TOP_N;
          return (
            <div
              key={cat}
              className="inline-flex items-center justify-between gap-2 text-sm"
            >
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={isOn} onChange={() => toggle(cat)} />
                {PRIZE_LABELS[cat]}
              </label>
              <label
                className={`inline-flex items-center gap-1 ${isOn ? '' : 'opacity-40'}`}
              >
                <span className="text-xs text-rd-ink/60">Top</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="w-14 border rounded px-2 py-1 tabular-nums disabled:bg-rd-cream/40"
                  disabled={!isOn}
                  value={top}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 1) setTopN(cat, n);
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
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
  const [cfg, setCfg] = useState<SheetsSettings | null>(loadSheetsSettings());
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

  const updateTeePar = (key: typeof TEE_KEYS[number], v: number) => {
    setDraft((d) => ({ ...d, tees: { ...d.tees, [key]: { ...d.tees[key], par: v } } }));
  };

  const updateTeeRatings = (
    key: typeof TEE_KEYS[number],
    gender: 'women' | 'men',
    field: 'cr' | 'slope',
    v: number
  ) => {
    setDraft((d) => ({
      ...d,
      tees: {
        ...d.tees,
        [key]: {
          ...d.tees[key],
          [gender]: { ...d.tees[key][gender], [field]: v },
        },
      },
    }));
  };

  const updateDivision = (idx: number, patch: Partial<DivisionConfig>) => {
    setDraft((d) => ({
      ...d,
      divisions: d.divisions.map((div, i) => (i === idx ? { ...div, ...patch } : div)),
    }));
  };

  const removeDivision = (idx: number) => {
    setDraft((d) => ({
      ...d,
      divisions: d.divisions.filter((_, i) => i !== idx),
    }));
  };

  const addDivision = () => {
    setDraft((d) => {
      const used = new Set(d.divisions.map((x) => x.code));
      const next = (['A', 'B', 'C', 'D'] as DivisionCode[]).find((c) => !used.has(c));
      if (!next) return d;
      return {
        ...d,
        divisions: [
          ...d.divisions,
          {
            code: next,
            name: `Division ${next}`,
            tee: 'red',
            hiMin: 0,
            hiMax: 54,
            handicapPct: 100,
          },
        ],
      };
    });
  };

  const updateHole = (idx: number, field: 'par' | 'siWomen' | 'siMen', v: number) => {
    setDraft((d) => {
      const holes = [
        ...(d.holes ??
          Array.from({ length: 18 }, () => ({ par: 4, siWomen: 0, siMen: 0 }))),
      ];
      holes[idx] = { ...holes[idx], [field]: v };
      return { ...d, holes };
    });
  };

  const totalHolePar = (draft.holes ?? []).reduce((a, h) => a + (h?.par ?? 0), 0);

  const onSave = async () => {
    const c = loadSheetsSettings();
    if (!c) {
      setStatus({
        kind: 'err',
        msg: 'No Sheet configured. Open Settings and set Sheet ID + Apps Script URL.',
      });
      return;
    }
    setStatus({ kind: 'busy', msg: 'Saving…' });
    try {
      await saveCourse(c, draft);
      setStatus({ kind: 'ok', msg: 'Saved. Spectators see the update on the next refresh (~15 s).' });
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
          {cfg ? 'Sheet: configured' : 'Configure Google Sheet'}
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

      <BrandingEditor
        branding={draft.branding}
        onChange={(b) => setDraft((d) => ({ ...d, branding: b }))}
      />

      <div className="rd-card p-4">
        <h2 className="text-lg text-rd-navy font-serif mb-2">Tees</h2>
        <p className="text-xs text-rd-ink/60 mb-2">
          Course rating and slope are stored per gender. The pair used at runtime
          is picked from the event gender (currently <strong>{draft.gender}</strong>).
        </p>
        <div className="overflow-x-auto">
          <table className="rd-table table-fixed">
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '18.5%' }} />
              <col style={{ width: '18.5%' }} />
              <col style={{ width: '18.5%' }} />
              <col style={{ width: '18.5%' }} />
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>Tee</th>
                <th rowSpan={2}>Par</th>
                <th colSpan={2} className="text-center">Ladies</th>
                <th colSpan={2} className="text-center">Mens</th>
              </tr>
              <tr>
                <th>CR</th>
                <th>Slope</th>
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
                      <NumField label="" value={t.par} onChange={(v) => updateTeePar(k, v)} />
                    </td>
                    <td>
                      <NumField
                        label=""
                        value={t.women.cr}
                        onChange={(v) => updateTeeRatings(k, 'women', 'cr', v)}
                      />
                    </td>
                    <td>
                      <NumField
                        label=""
                        value={t.women.slope}
                        onChange={(v) => updateTeeRatings(k, 'women', 'slope', v)}
                      />
                    </td>
                    <td>
                      <NumField
                        label=""
                        value={t.men.cr}
                        onChange={(v) => updateTeeRatings(k, 'men', 'cr', v)}
                      />
                    </td>
                    <td>
                      <NumField
                        label=""
                        value={t.men.slope}
                        onChange={(v) => updateTeeRatings(k, 'men', 'slope', v)}
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
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg text-rd-navy font-serif">Holes</h2>
          <span className="text-sm text-rd-ink/60">
            Total par: <span className="font-semibold">{totalHolePar || '—'}</span>
          </span>
        </div>
        <p className="text-xs text-rd-ink/60 mb-2">
          Per-hole par drives scorecard symbols (birdie/par/bogey…) on the Scores tab.
          Stroke index (SI) is the handicap-stroke ranking — 1 = hardest. Stored
          separately for ladies and mens; the active one follows the event gender.
        </p>
        <div className="overflow-x-auto">
          <table className="rd-table table-fixed">
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '33%' }} />
              <col style={{ width: '33%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Hole</th>
                <th>Par</th>
                <th>Ladies SI</th>
                <th>Mens SI</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 18 }, (_, i) => {
                const h = draft.holes?.[i] ?? { par: 4, siWomen: 0, siMen: 0 };
                return (
                  <tr key={i}>
                    <td className="font-medium">{i + 1}</td>
                    <td>
                      <NumField label="" value={h.par} onChange={(v) => updateHole(i, 'par', v)} />
                    </td>
                    <td>
                      <NumField
                        label=""
                        value={h.siWomen}
                        onChange={(v) => updateHole(i, 'siWomen', v)}
                      />
                    </td>
                    <td>
                      <NumField
                        label=""
                        value={h.siMen}
                        onChange={(v) => updateHole(i, 'siMen', v)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CountOutEditor
        countOut={draft.countOut}
        onChange={(co) => setDraft((d) => ({ ...d, countOut: co }))}
      />

      <div className="rd-card p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg text-rd-navy font-serif">Divisions</h2>
          <button
            type="button"
            className="text-sm text-rd-navy hover:underline disabled:opacity-40 disabled:no-underline"
            disabled={draft.divisions.length >= 4}
            onClick={addDivision}
          >
            + Add division
          </button>
        </div>
        <div className="space-y-3">
          {draft.divisions.map((div, idx) => (
            <div
              key={div.code}
              className="border border-rd-cream rounded p-3 grid grid-cols-2 sm:grid-cols-6 gap-3"
            >
              <div className="col-span-2 sm:col-span-1 flex items-baseline justify-between sm:block">
                <div>
                  <span className="text-xs text-rd-ink/60 block">Code</span>
                  <div className="font-semibold mt-0.5">{div.code}</div>
                </div>
                <button
                  type="button"
                  className="text-xs text-red-700 hover:underline mt-1"
                  onClick={() => removeDivision(idx)}
                >
                  Remove
                </button>
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
                value={div.hiMin}
                onChange={(v) => updateDivision(idx, { hiMin: v })}
              />
              <NumField
                label="HI max"
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

              <div className="col-span-2 sm:col-span-6 border-t border-rd-cream pt-3">
                <PrizesEditor
                  prizes={div.prizes}
                  onChange={(p) => updateDivision(idx, { prizes: p })}
                />
              </div>
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
        <SheetSettingsDialog
          initial={cfg}
          onSaved={(s) => {
            setCfg(s);
            setShowSettings(false);
          }}
          onCancel={() => {
            setCfg(loadSheetsSettings());
            setShowSettings(false);
          }}
        />
      )}
    </section>
  );
}
