import { fullName } from '../../format';
import type { PlayerLine } from '../../scoring/engine';

export type ComparisonState = {
  eventAvg: boolean;
  divisionAvg: boolean;
  otherSaIds: string[];
};

export function ComparisonControls({
  selfSaId,
  hasDivision,
  candidateLines,
  value,
  onChange,
}: {
  selfSaId: string;
  hasDivision: boolean;
  candidateLines: PlayerLine[];
  value: ComparisonState;
  onChange: (next: ComparisonState) => void;
}) {
  const remaining = candidateLines.filter(
    (l) => l.player.saId !== selfSaId && !value.otherSaIds.includes(l.player.saId)
  );

  const toggle = (key: 'eventAvg' | 'divisionAvg') =>
    onChange({ ...value, [key]: !value[key] });

  const addOther = (saId: string) => {
    if (!saId || value.otherSaIds.includes(saId)) return;
    onChange({ ...value, otherSaIds: [...value.otherSaIds, saId] });
  };

  const removeOther = (saId: string) =>
    onChange({
      ...value,
      otherSaIds: value.otherSaIds.filter((id) => id !== saId),
    });

  const chipPlayer = (saId: string) =>
    candidateLines.find((l) => l.player.saId === saId);

  return (
    <div className="rd-card p-3 sm:p-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-rd-ink/60">
        Compare against
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <label className="inline-flex items-center gap-2 text-rd-ink/60">
          <input
            type="checkbox"
            checked
            disabled
            className="accent-rd-navy"
            aria-label="This player (always shown)"
          />
          This player
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.eventAvg}
            onChange={() => toggle('eventAvg')}
            className="accent-rd-navy"
          />
          Event average
        </label>
        <label
          className={`inline-flex items-center gap-2 ${
            hasDivision ? 'cursor-pointer' : 'text-rd-ink/40'
          }`}
        >
          <input
            type="checkbox"
            checked={value.divisionAvg}
            onChange={() => toggle('divisionAvg')}
            disabled={!hasDivision}
            className="accent-rd-navy"
          />
          Division average
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">
          <span className="text-rd-ink/70 mr-2">Add player:</span>
          <select
            value=""
            onChange={(e) => {
              addOther(e.target.value);
              e.target.value = '';
            }}
            className="border border-rd-cream rounded px-2 py-1 text-sm"
            disabled={remaining.length === 0}
          >
            <option value="">
              {remaining.length === 0 ? '— none left —' : 'Choose…'}
            </option>
            {remaining.map((l) => (
              <option key={l.player.saId} value={l.player.saId}>
                {fullName(l.player)}
              </option>
            ))}
          </select>
        </label>
        {value.otherSaIds.map((saId) => {
          const line = chipPlayer(saId);
          return (
            <span
              key={saId}
              className="inline-flex items-center gap-1 text-xs bg-rd-navy/10 text-rd-navy rounded-full pl-2 pr-1 py-0.5"
            >
              {line ? fullName(line.player) : saId}
              <button
                type="button"
                onClick={() => removeOther(saId)}
                aria-label={`Remove ${line ? fullName(line.player) : saId} from comparison`}
                className="hover:bg-rd-navy/20 rounded-full w-4 h-4 leading-none"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
