import { useEffect, useState } from 'react';
import type { Player } from '../types';

type Draft = {
  firstName: string;
  lastName: string;
  saId: string;
  hi: string; // kept as string so the input can be cleared mid-typing
  divisionOverride: '' | 'A' | 'B' | 'C' | 'D';
};

function toDraft(p: Player | null): Draft {
  return {
    firstName: p?.firstName ?? '',
    lastName: p?.lastName ?? '',
    saId: p?.saId ?? '',
    hi: p == null ? '' : String(p.hi),
    divisionOverride: p?.divisionOverride ?? '',
  };
}

export function PlayerEditModal({
  initial,
  existingSaIds,
  busy,
  onSave,
  onCancel,
}: {
  /** null when adding; the existing record when editing. */
  initial: Player | null;
  /** SA IDs already in the roster (used for uniqueness check on add). */
  existingSaIds: Set<string>;
  busy?: boolean;
  onSave: (player: Player) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));

  useEffect(() => {
    setDraft(toDraft(initial));
  }, [initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  const isEdit = initial != null;
  const trimmedSa = draft.saId.trim();
  const hiNum = Number(draft.hi);
  const errors: string[] = [];
  if (!draft.firstName.trim()) errors.push('First name is required.');
  if (!draft.lastName.trim()) errors.push('Last name is required.');
  if (!trimmedSa) errors.push('SA ID is required.');
  if (!Number.isFinite(hiNum)) errors.push('HI must be a number.');
  if (!isEdit && trimmedSa && existingSaIds.has(trimmedSa)) {
    errors.push('A player with that SA ID already exists.');
  }

  const submit = () => {
    if (errors.length) return;
    const player: Player = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      saId: trimmedSa,
      hi: hiNum,
    };
    if (draft.divisionOverride) player.divisionOverride = draft.divisionOverride;
    onSave(player);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-3 z-50 overflow-y-auto"
      onClick={onCancel}
    >
      <div
        className="rd-card p-5 w-full max-w-lg my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl text-rd-navy font-serif">
            {isEdit ? 'Edit player' : 'Add player'}
          </h2>
          <button
            className="text-sm text-rd-ink/60 hover:text-rd-navy"
            onClick={onCancel}
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-rd-ink/60 block">First name</span>
            <input
              className="w-full border rounded px-2 py-1 mt-0.5"
              value={draft.firstName}
              onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs text-rd-ink/60 block">Last name</span>
            <input
              className="w-full border rounded px-2 py-1 mt-0.5"
              value={draft.lastName}
              onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs text-rd-ink/60 block">SA ID</span>
            <input
              className="w-full border rounded px-2 py-1 mt-0.5 font-mono text-sm"
              value={draft.saId}
              disabled={isEdit}
              onChange={(e) => setDraft((d) => ({ ...d, saId: e.target.value }))}
            />
            {isEdit && (
              <span className="text-[11px] text-rd-ink/50">
                Stable identifier — can't be changed once a player exists.
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-xs text-rd-ink/60 block">Handicap Index (HI)</span>
            <input
              type="text"
              inputMode="decimal"
              className="w-full border rounded px-2 py-1 mt-0.5 tabular-nums"
              value={draft.hi}
              onChange={(e) => setDraft((d) => ({ ...d, hi: e.target.value }))}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-rd-ink/60 block">Division override</span>
            <select
              className="w-full border rounded px-2 py-1 mt-0.5"
              value={draft.divisionOverride}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  divisionOverride: e.target.value as Draft['divisionOverride'],
                }))
              }
            >
              <option value="">(auto — use HI)</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
            <span className="text-[11px] text-rd-ink/50">
              Forces this player into a specific division regardless of HI.
            </span>
          </label>
        </div>

        {errors.length > 0 && (
          <ul className="mt-3 text-sm text-red-700 list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            className="px-3 py-1.5 text-sm rounded border border-rd-cream"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-1.5 text-sm rounded bg-rd-navy text-white disabled:opacity-50"
            disabled={errors.length > 0 || busy}
            onClick={submit}
          >
            {busy ? 'Saving…' : isEdit ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
