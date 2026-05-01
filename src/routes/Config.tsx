import { useEffect, useState } from 'react';
import { useIsAdmin } from '../admin';
import { SheetSettingsDialog } from '../components/SheetSettingsDialog';
import { Tabs, type TabItem } from '../components/Tabs';
import type { AppData } from '../data';
import {
  CATEGORIES_FOR_FORMAT,
  DEFAULT_TOP_N,
  defaultAwards,
  PRIZE_LABELS,
} from '../prizes';
import { buildPlayerLines, DEFAULT_COUNT_OUT_STEPS, divisionFor } from '../scoring/engine';
import { generateBracket, matchesByRound, propagateAll, roundLabel } from '../scoring/matchPlay';
import { generateDraw } from '../scoring/teeTimes';
import { saveCourse } from '../sheets/courseAdapter';
import { clearMatches, saveMatches } from '../sheets/matchesAdapter';
import { loadSheetsSettings, type SheetsSettings } from '../sheets/settings';
import { saveTeeTimes } from '../sheets/teeTimesAdapter';
import { resolveAssetUrl } from '../theme';
import type {
  Branding,
  BrandingColors,
  CountOutConfig,
  CountOutSegment,
  Course,
  DivisionCode,
  DivisionConfig,
  DivisionFormat,
  PrizeAward,
  PrizeCategory,
  PrizeConfig,
  TeeTimeConfig,
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

function MatchPlayEditor({
  divisionCode,
  divisionName,
  course,
  players,
  matches,
  matchPlay,
  onChange,
  onGenerate,
  onReset,
  onSaveMatchResult,
  status,
}: {
  divisionCode: DivisionCode;
  divisionName: string;
  course: Course;
  players: import('../types').Player[];
  matches: import('../types').Match[];
  matchPlay: import('../types').MatchPlayConfig | undefined;
  onChange: (mp: import('../types').MatchPlayConfig) => void;
  onGenerate: () => void;
  onReset: () => void;
  onSaveMatchResult: (matchId: string, winnerSaId: string | undefined, result: string) => void;
  status: { kind: 'idle' | 'busy' | 'ok' | 'err'; msg?: string };
}) {
  const enabled = !!matchPlay?.enabled;
  const name = matchPlay?.name ?? '';
  const generatedAt = matchPlay?.bracketGeneratedAt;

  const patch = (next: Partial<import('../types').MatchPlayConfig>) =>
    onChange({ ...(matchPlay ?? { enabled: false }), enabled, name, ...next });

  // Pool: players whose live division resolves to this one, AND who haven't
  // explicitly opted out. (Default-opt-in.)
  const optedPool = players.filter(
    (p) =>
      p.matchPlay !== false &&
      divisionFor(p, course)?.code === divisionCode
  );

  // Distribution across all divisions, so the admin can see at a glance
  // how the field is split (e.g. "Gold 0, Silver 8, Bronze 12, Copper 4").
  const optInsByDivision = course.divisions.reduce<Record<string, number>>(
    (acc, d) => {
      acc[d.code] = players.filter(
        (p) => p.matchPlay !== false && divisionFor(p, course)?.code === d.code
      ).length;
      return acc;
    },
    {}
  );
  const totalOptedIn = players.filter((p) => p.matchPlay !== false).length;
  const optedOutCount = players.filter((p) => p.matchPlay === false).length;

  // Power-of-two-up size, mirroring the engine.
  const computedSize =
    optedPool.length < 2
      ? 0
      : 1 << Math.ceil(Math.log2(optedPool.length));

  const playerById = new Map(players.map((p) => [p.saId, p]));
  const nameOf = (saId: string | undefined): string => {
    if (!saId) return '';
    const p = playerById.get(saId);
    return p ? fullNameInline(p) : `(${saId})`;
  };

  const divisionMatches = matches.filter((m) => m.divisionCode === divisionCode);
  const rounds = matchesByRound(divisionMatches);
  const totalRounds = rounds.length;

  return (
    <div className="space-y-4">
      <div className="rd-card p-4 space-y-3">
        <div>
          <h2 className="text-lg text-rd-navy font-serif">
            {divisionName} Match Play
          </h2>
          <p className="text-xs text-rd-ink/60 mt-1">
            Single-elimination knockout for {divisionName}. Players are seeded
            by HI; top seeds get byes when opt-ins isn't a power of 2. Players
            opt in/out individually via Manage Players (default: opted in).
          </p>
        </div>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          <span className="text-sm">Enable {divisionName} Match Play</span>
        </label>

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
          <label className="block">
            <span className="text-xs text-rd-ink/60 block">Display name</span>
            <input
              type="text"
              className="w-full border rounded px-2 py-1 mt-0.5"
              placeholder={`e.g. ${divisionName} MP`}
              value={name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
        </div>
      </div>

      {enabled && (
        <div className="rd-card p-4 space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-rd-ink/60">{divisionName} opt-ins:</span>{' '}
              <span className="font-semibold text-rd-navy">{optedPool.length}</span>
            </div>
            <div>
              <span className="text-rd-ink/60">Bracket size:</span>{' '}
              <span className="font-semibold text-rd-navy">
                {computedSize > 0 ? computedSize : '—'}
              </span>
            </div>
            <div>
              <span className="text-rd-ink/60">Last generated:</span>{' '}
              <span className="text-rd-ink/80">
                {generatedAt
                  ? new Date(generatedAt).toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : 'never'}
              </span>
            </div>
          </div>
          <div className="text-xs text-rd-ink/60 flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-rd-cream/60">
            <span className="text-rd-ink/50">Across all divisions:</span>
            {course.divisions.map((d) => (
              <span key={d.code} className={d.code === divisionCode ? 'text-rd-navy font-semibold' : ''}>
                {d.name || d.code} {optInsByDivision[d.code] ?? 0}
              </span>
            ))}
            <span className="text-rd-ink/50">
              · total opted in {totalOptedIn}
              {optedOutCount > 0 ? ` · opted out ${optedOutCount}` : ''}
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="px-3 py-1.5 text-sm bg-rd-navy text-white rounded font-medium disabled:opacity-50"
              disabled={status.kind === 'busy' || optedPool.length < 2}
              onClick={onGenerate}
              title={
                optedPool.length < 2
                  ? 'Need at least 2 opt-ins to generate a bracket.'
                  : undefined
              }
            >
              Generate bracket
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded border border-rd-cream text-rd-navy disabled:opacity-50"
              disabled={status.kind === 'busy' || divisionMatches.length === 0}
              onClick={onReset}
            >
              Reset bracket
            </button>
          </div>

          {status.msg && (
            <span
              className={`text-sm block ${
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

          {/* Quick verify: list the names + HIs of players who'd land in this
              bracket. Helps catch "I expected Jane in Gold but she's Silver"
              before generating. */}
          <details className="text-xs">
            <summary className="cursor-pointer text-rd-navy hover:underline">
              {optedPool.length === 0
                ? `Show players in ${divisionName} (none)`
                : `Show ${optedPool.length} player${
                    optedPool.length === 1 ? '' : 's'
                  } in ${divisionName}`}
            </summary>
            {optedPool.length > 0 ? (
              <ul className="mt-2 columns-2 gap-x-4">
                {[...optedPool]
                  .sort((a, b) => a.hi - b.hi || a.lastName.localeCompare(b.lastName))
                  .map((p) => (
                    <li
                      key={p.saId}
                      className="text-rd-ink/80 flex items-baseline gap-2"
                    >
                      <span className="flex-1 truncate">{fullNameInline(p)}</span>
                      <span className="tabular-nums text-rd-ink/50">
                        HI {p.hi}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-2 text-rd-ink/60">
                No players resolve to {divisionName} (HI {course.divisions.find((d) => d.code === divisionCode)?.hiMin}–
                {course.divisions.find((d) => d.code === divisionCode)?.hiMax}). Check
                division boundaries on the Divisions tab if you expected someone
                here.
              </p>
            )}
          </details>
        </div>
      )}

      {enabled && divisionMatches.length > 0 && (
        <div className="rd-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-rd-navy uppercase tracking-wide">
            Match results
          </h3>
          <p className="text-xs text-rd-ink/60">
            Pick the winner and enter the result text (e.g. "1 up", "3 and 2",
            "won on 19th"). Results cascade to later rounds automatically.
            Re-entering an earlier round clears any downstream winner that's no
            longer valid.
          </p>
          <div className="space-y-4">
            {rounds.map((roundMatches, idx) => {
              const round = idx + 1;
              return (
                <div key={round}>
                  <div className="text-xs uppercase tracking-wide text-rd-ink/60 font-semibold mb-1">
                    {roundLabel(round, totalRounds)}
                  </div>
                  <div className="rd-card overflow-x-auto">
                    <table className="rd-table text-xs">
                      <thead>
                        <tr>
                          <th>Match</th>
                          <th>Player A</th>
                          <th>Player B</th>
                          <th>Winner</th>
                          <th>Result</th>
                          <th aria-label="Save"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {roundMatches.map((m) => (
                          <MatchResultRow
                            key={m.id}
                            match={m}
                            nameOf={nameOf}
                            onSave={onSaveMatchResult}
                            disabled={status.kind === 'busy'}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Local helper — avoids re-importing fullName up top with a new import line. */
function fullNameInline(p: import('../types').Player): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

function MatchResultRow({
  match,
  nameOf,
  onSave,
  disabled,
}: {
  match: import('../types').Match;
  nameOf: (saId: string | undefined) => string;
  onSave: (id: string, winnerSaId: string | undefined, result: string) => void;
  disabled: boolean;
}) {
  const isBye = match.result === 'bye';
  const [winner, setWinner] = useState<string>(match.winnerSaId ?? '');
  const [result, setResult] = useState<string>(match.result ?? '');

  // Re-sync local state when the match prop changes (e.g. after propagation).
  useEffect(() => {
    setWinner(match.winnerSaId ?? '');
    setResult(match.result ?? '');
  }, [match.winnerSaId, match.result]);

  const haveBoth = !!match.playerASaId && !!match.playerBSaId;
  const dirty = (winner || '') !== (match.winnerSaId ?? '') || result !== (match.result ?? '');

  if (isBye) {
    return (
      <tr className="text-rd-ink/50">
        <td className="font-mono">{match.id}</td>
        <td>{nameOf(match.playerASaId)}</td>
        <td>{nameOf(match.playerBSaId)}</td>
        <td colSpan={3} className="italic">bye — auto-advanced</td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="font-mono">{match.id}</td>
      <td>{nameOf(match.playerASaId) || <span className="text-rd-ink/40">—</span>}</td>
      <td>{nameOf(match.playerBSaId) || <span className="text-rd-ink/40">—</span>}</td>
      <td>
        <select
          className="border rounded px-1 py-0.5"
          value={winner}
          disabled={!haveBoth || disabled}
          onChange={(e) => setWinner(e.target.value)}
        >
          <option value="">—</option>
          {match.playerASaId && <option value={match.playerASaId}>A</option>}
          {match.playerBSaId && <option value={match.playerBSaId}>B</option>}
        </select>
      </td>
      <td>
        <input
          type="text"
          className="border rounded px-1 py-0.5 w-28"
          placeholder="e.g. 3 and 2"
          value={result}
          disabled={!haveBoth || disabled}
          onChange={(e) => setResult(e.target.value)}
        />
      </td>
      <td className="text-right">
        <button
          type="button"
          className="text-xs text-rd-navy hover:underline disabled:opacity-40"
          disabled={!dirty || disabled || !haveBoth}
          onClick={() => onSave(match.id, winner || undefined, result)}
        >
          Save
        </button>
      </td>
    </tr>
  );
}

function TeeTimesEditor({
  teeTimes,
  onChange,
  onGenerate,
  generateStatus,
  hasDay1Scores,
}: {
  teeTimes: TeeTimeConfig | undefined;
  onChange: (tt: TeeTimeConfig) => void;
  onGenerate: (day: 1 | 2) => void;
  generateStatus: { kind: 'idle' | 'busy' | 'ok' | 'err'; msg?: string };
  hasDay1Scores: boolean;
}) {
  const enabled = !!teeTimes?.enabled;
  const groupSize = teeTimes?.groupSize ?? 4;
  const intervalMinutes = teeTimes?.intervalMinutes ?? 10;
  const day1Start = teeTimes?.day1Start ?? '08:00';
  const day2Start = teeTimes?.day2Start ?? '08:00';
  const day1Order = teeTimes?.day1Order ?? 'best-first';
  const day2Order = teeTimes?.day2Order ?? 'worst-first';

  const patch = (next: Partial<TeeTimeConfig>) =>
    onChange({
      enabled,
      groupSize,
      intervalMinutes,
      day1Start,
      day2Start,
      day1Order,
      day2Order,
      ...next,
    });

  return (
    <div className="rd-card p-4 space-y-3">
      <div>
        <h2 className="text-lg text-rd-navy font-serif">Tee Times</h2>
        <p className="text-xs text-rd-ink/60 mt-1">
          Auto-generates a draw and writes it to the <code>TeeTimes</code> Sheet
          tab. Each day has its own ordering — <em>best off first</em> puts
          A-scratch in the first group; <em>worst first, best last</em> puts
          A-scratch in the last group (leaders home in the final group).
          Stableford and medal players never share a group.
        </p>
      </div>

      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        <span className="text-sm">Enable Tee Times tab</span>
      </label>

      <div className={`space-y-3 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block col-span-2 sm:col-span-1">
            <span className="text-xs text-rd-ink/60 block">Group size</span>
            <select
              className="w-full border rounded px-2 py-1 mt-0.5"
              value={String(groupSize)}
              onChange={(e) => patch({ groupSize: Number(e.target.value) as 2 | 3 | 4 })}
            >
              <option value="2">2-balls</option>
              <option value="3">3-balls</option>
              <option value="4">4-balls</option>
            </select>
          </label>
          <NumField
            label="Interval (mins)"
            value={intervalMinutes}
            onChange={(v) => patch({ intervalMinutes: v })}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
          <label className="block">
            <span className="text-xs text-rd-ink/60 block">Day 1 start</span>
            <input
              type="time"
              className="w-full border rounded px-2 py-1 mt-0.5 tabular-nums"
              value={day1Start}
              onChange={(e) => patch({ day1Start: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-rd-ink/60 block">Day 1 order</span>
            <select
              className="w-full border rounded px-2 py-1 mt-0.5"
              value={day1Order}
              onChange={(e) => patch({ day1Order: e.target.value as 'best-first' | 'worst-first' })}
            >
              <option value="best-first">Best off first</option>
              <option value="worst-first">Worst first, best last</option>
            </select>
          </label>
          <button
            type="button"
            className="col-span-2 sm:col-span-1 px-3 py-1.5 text-sm bg-rd-navy text-white rounded font-medium disabled:opacity-50"
            disabled={generateStatus.kind === 'busy' || !enabled}
            onClick={() => onGenerate(1)}
          >
            Generate Day 1 draw
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
          <label className="block">
            <span className="text-xs text-rd-ink/60 block">Day 2 start</span>
            <input
              type="time"
              className="w-full border rounded px-2 py-1 mt-0.5 tabular-nums"
              value={day2Start}
              onChange={(e) => patch({ day2Start: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-rd-ink/60 block">Day 2 order</span>
            <select
              className="w-full border rounded px-2 py-1 mt-0.5"
              value={day2Order}
              onChange={(e) => patch({ day2Order: e.target.value as 'best-first' | 'worst-first' })}
            >
              <option value="best-first">Best off first</option>
              <option value="worst-first">Worst first, best last</option>
            </select>
          </label>
          <button
            type="button"
            className="col-span-2 sm:col-span-1 px-3 py-1.5 text-sm bg-rd-navy text-white rounded font-medium disabled:opacity-40"
            disabled={generateStatus.kind === 'busy' || !hasDay1Scores || !enabled}
            onClick={() => onGenerate(2)}
            title={
              hasDay1Scores
                ? undefined
                : 'Enter at least one Day-1 score before generating Day 2 — the order needs standings.'
            }
          >
            Generate Day 2 draw
          </button>
        </div>
      </div>

      {enabled && (
        <div className="space-y-2 pt-1 border-t border-rd-cream/60 mt-1">
          <span className="text-xs text-rd-ink/60 block">
            Generating overwrites the requested day's rows in the Sheet; the
            other day stays put. Save course settings first if you've changed
            anything above.
          </span>
          {generateStatus.msg && (
            <span
              className={`text-sm block ${
                generateStatus.kind === 'err'
                  ? 'text-red-700'
                  : generateStatus.kind === 'ok'
                    ? 'text-green-700'
                    : 'text-rd-ink/70'
              }`}
            >
              {generateStatus.msg}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function PrizesEditor({
  prizes,
  format,
  onChange,
}: {
  prizes: PrizeConfig | undefined;
  format: DivisionFormat;
  onChange: (p: PrizeConfig) => void;
}) {
  const availableCategories = CATEGORIES_FOR_FORMAT[format];
  const awards = prizes?.awards ?? defaultAwards(format);
  const enabled = new Map<PrizeCategory, number>(awards.map((a) => [a.category, a.topN]));

  const setAwards = (next: PrizeAward[]) => {
    // Keep awards in canonical category order, scoped to the format's categories.
    const ordered = availableCategories.flatMap((c) => {
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
        {availableCategories.map((cat) => {
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
  const [teeTimesStatus, setTeeTimesStatus] = useState<{
    kind: 'idle' | 'busy' | 'ok' | 'err';
    msg?: string;
  }>({ kind: 'idle' });
  const [matchPlayStatus, setMatchPlayStatus] = useState<{
    kind: 'idle' | 'busy' | 'ok' | 'err';
    msg?: string;
  }>({ kind: 'idle' });
  const [cfg, setCfg] = useState<SheetsSettings | null>(loadSheetsSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('event');
  const [activeDivisionCode, setActiveDivisionCode] = useState<string>(
    data.course.divisions[0]?.code ?? 'A'
  );

  const CONFIG_TABS: TabItem[] = [
    { id: 'event', label: 'Event' },
    { id: 'course', label: 'Course' },
    { id: 'divisions', label: 'Divisions' },
    { id: 'rules', label: 'Rules' },
    { id: 'tee-times', label: 'Tee Times' },
    { id: 'match-play', label: 'Match Play' },
    { id: 'branding', label: 'Branding' },
  ];

  // Reset the draft if the underlying data refreshes (e.g. after a save).
  useEffect(() => {
    setDraft(structuredClone(data.course));
  }, [data.course]);

  // If the active division was removed (or never matched), fall back to the
  // first remaining division so the editor doesn't render blank.
  useEffect(() => {
    if (
      draft.divisions.length > 0 &&
      !draft.divisions.find((d) => d.code === activeDivisionCode)
    ) {
      setActiveDivisionCode(draft.divisions[0].code);
    }
  }, [draft.divisions, activeDivisionCode]);

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
    const used = new Set(draft.divisions.map((x) => x.code));
    const next = (['A', 'B', 'C', 'D'] as DivisionCode[]).find((c) => !used.has(c));
    if (!next) return;
    setDraft((d) => ({
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
    }));
    setActiveDivisionCode(next);
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

  const hasDay1Scores = data.scores.some(
    (s) => s.day === 1 && s.holes.some((h) => h != null)
  );

  const handleGenerateTeeTimes = async (day: 1 | 2) => {
    const c = loadSheetsSettings();
    if (!c) {
      setTeeTimesStatus({
        kind: 'err',
        msg: 'No Sheet configured. Open Settings and set Sheet ID + Apps Script URL.',
      });
      return;
    }
    if (!draft.teeTimes?.enabled) {
      setTeeTimesStatus({ kind: 'err', msg: 'Enable Tee Times above first.' });
      return;
    }
    const ok = window.confirm(
      `This will overwrite the Day ${day} tee times in the Sheet. Continue?`
    );
    if (!ok) return;
    setTeeTimesStatus({ kind: 'busy', msg: `Generating Day ${day}…` });
    try {
      // Use the live Course from `data` rather than `draft` so a player who
      // hasn't saved their settings tweaks doesn't get a draw against a
      // stale config. Generation reads from the source of truth.
      const lines = buildPlayerLines(data.players, data.scores, data.course);
      const rows = generateDraw(day, lines, data.course, draft.teeTimes);
      await saveTeeTimes(c, day, rows);
      setTeeTimesStatus({
        kind: 'ok',
        msg: `Day ${day} draw saved (${rows.length} rows). Spectators see it on the next refresh (~15 s).`,
      });
      await data.reload();
    } catch (e) {
      setTeeTimesStatus({
        kind: 'err',
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  };

  /** Match Play handlers. All operate per-division: each writes a fresh
   *  full-tab payload that keeps OTHER divisions' rows intact. */

  const handleGenerateBracket = async (divisionCode: DivisionCode) => {
    const c = loadSheetsSettings();
    if (!c) {
      setMatchPlayStatus({
        kind: 'err',
        msg: 'No Sheet configured. Open Settings and set Sheet ID + Apps Script URL.',
      });
      return;
    }
    const divisionDraft = draft.divisions.find((d) => d.code === divisionCode);
    if (!divisionDraft?.matchPlay?.enabled) {
      setMatchPlayStatus({
        kind: 'err',
        msg: `Enable Match Play for ${divisionCode} first.`,
      });
      return;
    }
    // Default-opt-in: anyone whose matchPlay isn't explicitly `false` AND who
    // actually plays in this division (after divisionOverride resolution).
    const opted = data.players.filter(
      (p) =>
        p.matchPlay !== false &&
        divisionFor(p, data.course)?.code === divisionCode
    );
    if (opted.length < 2) {
      setMatchPlayStatus({
        kind: 'err',
        msg: `Need at least 2 opt-ins in ${divisionCode} to generate a bracket.`,
      });
      return;
    }
    const ok = window.confirm(
      `This will overwrite the ${divisionCode} bracket with a fresh draw of ${opted.length} players. Continue?`
    );
    if (!ok) return;
    setMatchPlayStatus({ kind: 'busy', msg: `Generating ${divisionCode}…` });
    try {
      const bracket = generateBracket(opted, divisionCode);
      // Merge: drop any existing matches for this division, append the new ones.
      const others = data.matches.filter((m) => m.divisionCode !== divisionCode);
      await saveMatches(c, [...others, ...bracket]);
      // Persist the generated-at on the Division's config.
      const generatedAt = new Date().toISOString();
      setDraft((d) => ({
        ...d,
        divisions: d.divisions.map((dv) =>
          dv.code === divisionCode
            ? {
                ...dv,
                matchPlay: { ...(dv.matchPlay ?? { enabled: true }), bracketGeneratedAt: generatedAt },
              }
            : dv
        ),
      }));
      setMatchPlayStatus({
        kind: 'ok',
        msg: `${divisionCode} bracket saved (${bracket.length} matches). Save Course below to record the generated-at time.`,
      });
      await data.reload();
    } catch (e) {
      setMatchPlayStatus({
        kind: 'err',
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleResetBracket = async (divisionCode: DivisionCode) => {
    const c = loadSheetsSettings();
    if (!c) {
      setMatchPlayStatus({ kind: 'err', msg: 'No Sheet configured.' });
      return;
    }
    const ok = window.confirm(
      `This will clear the ${divisionCode} bracket. All entered results for ${divisionCode} will be lost. Continue?`
    );
    if (!ok) return;
    setMatchPlayStatus({ kind: 'busy', msg: `Clearing ${divisionCode}…` });
    try {
      const others = data.matches.filter((m) => m.divisionCode !== divisionCode);
      // If others is empty, the whole tab is wiped via clearMatches; otherwise
      // a bulk-replace with just the remaining rows is the cheapest path.
      if (others.length === 0) {
        await clearMatches(c);
      } else {
        await saveMatches(c, others);
      }
      setDraft((d) => ({
        ...d,
        divisions: d.divisions.map((dv) =>
          dv.code === divisionCode
            ? {
                ...dv,
                matchPlay: { ...(dv.matchPlay ?? { enabled: true }), bracketGeneratedAt: undefined },
              }
            : dv
        ),
      }));
      setMatchPlayStatus({ kind: 'ok', msg: `${divisionCode} bracket cleared.` });
      await data.reload();
    } catch (e) {
      setMatchPlayStatus({
        kind: 'err',
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleSaveMatchResult = async (
    matchId: string,
    divisionCode: DivisionCode,
    winnerSaId: string | undefined,
    result: string
  ) => {
    const c = loadSheetsSettings();
    if (!c) {
      setMatchPlayStatus({ kind: 'err', msg: 'No Sheet configured.' });
      return;
    }
    setMatchPlayStatus({ kind: 'busy', msg: 'Saving result…' });
    try {
      const updated = data.matches.map((m) =>
        m.id === matchId && m.divisionCode === divisionCode
          ? { ...m, winnerSaId, result }
          : m
      );
      const propagated = propagateAll(updated);
      await saveMatches(c, propagated);
      setMatchPlayStatus({ kind: 'ok', msg: 'Result saved.' });
      await data.reload();
    } catch (e) {
      setMatchPlayStatus({
        kind: 'err',
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  };

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
            Event setup, divisions, tournament rules, and branding. Save changes
            below to commit them to the Course tab in your Sheet.
          </p>
        </div>
        <button
          className="text-sm text-rd-navy hover:underline whitespace-nowrap"
          onClick={() => setShowSettings(true)}
        >
          {cfg ? 'Sheet: configured' : 'Configure Google Sheet'}
        </button>
      </div>

      <Tabs tabs={CONFIG_TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'event' && (
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
      )}

      {activeTab === 'branding' && (
        <BrandingEditor
          branding={draft.branding}
          onChange={(b) => setDraft((d) => ({ ...d, branding: b }))}
        />
      )}

      {activeTab === 'course' && (
      <>
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

      </>
      )}

      {activeTab === 'rules' && (
        <CountOutEditor
          countOut={draft.countOut}
          onChange={(co) => setDraft((d) => ({ ...d, countOut: co }))}
        />
      )}

      {activeTab === 'tee-times' && (
        <TeeTimesEditor
          teeTimes={draft.teeTimes}
          onChange={(tt) => setDraft((d) => ({ ...d, teeTimes: tt }))}
          onGenerate={(day) => void handleGenerateTeeTimes(day)}
          generateStatus={teeTimesStatus}
          hasDay1Scores={hasDay1Scores}
        />
      )}

      {activeTab === 'match-play' && (
        <div className="rd-card p-4">
          {draft.divisions.length === 0 ? (
            <p className="text-sm text-rd-ink/60">
              Add a division first under Divisions to configure Match Play.
            </p>
          ) : (
            <>
              <Tabs
                tabs={draft.divisions.map((d) => ({
                  id: d.code,
                  label: d.name || `Division ${d.code}`,
                }))}
                active={activeDivisionCode}
                onChange={setActiveDivisionCode}
              />
              {(() => {
                const div = draft.divisions.find((d) => d.code === activeDivisionCode);
                if (!div) return null;
                return (
                  <MatchPlayEditor
                    divisionCode={div.code}
                    divisionName={div.name || `Division ${div.code}`}
                    course={data.course}
                    players={data.players}
                    matches={data.matches}
                    matchPlay={div.matchPlay}
                    onChange={(mp) =>
                      setDraft((d) => ({
                        ...d,
                        divisions: d.divisions.map((dv) =>
                          dv.code === div.code ? { ...dv, matchPlay: mp } : dv
                        ),
                      }))
                    }
                    onGenerate={() => void handleGenerateBracket(div.code)}
                    onReset={() => void handleResetBracket(div.code)}
                    onSaveMatchResult={(id, w, r) =>
                      void handleSaveMatchResult(id, div.code, w, r)
                    }
                    status={matchPlayStatus}
                  />
                );
              })()}
            </>
          )}
        </div>
      )}

      {activeTab === 'divisions' && (
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
        {draft.divisions.length === 0 ? (
          <p className="text-sm text-rd-ink/60">
            No divisions yet — add one to get started.
          </p>
        ) : (
          <>
            <Tabs
              tabs={draft.divisions.map((d) => ({
                id: d.code,
                label: d.name || `Division ${d.code}`,
              }))}
              active={activeDivisionCode}
              onChange={setActiveDivisionCode}
            />
            {draft.divisions
              .map((div, idx) => ({ div, idx }))
              .filter(({ div }) => div.code === activeDivisionCode)
              .map(({ div, idx }) => (
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
              <label className="block col-span-2 sm:col-span-1">
                <span className="text-xs text-rd-ink/60 block">Format</span>
                <select
                  className="w-full border rounded px-2 py-1 mt-0.5"
                  value={div.format ?? 'medal'}
                  onChange={(e) => {
                    const nextFormat = e.target.value as DivisionFormat;
                    // Reset prizes to the new format's defaults so any net/eclectic
                    // entries from medal don't linger on a stableford division
                    // (and vice versa). User can re-customise after.
                    updateDivision(idx, {
                      format: nextFormat,
                      prizes: { awards: defaultAwards(nextFormat) },
                    });
                  }}
                >
                  <option value="medal">Medal / Stroke</option>
                  <option value="stableford">Stableford</option>
                </select>
              </label>
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
                  format={div.format ?? 'medal'}
                  onChange={(p) => updateDivision(idx, { prizes: p })}
                />
              </div>
            </div>
              ))}
          </>
        )}
      </div>
      )}

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
