import { useMemo, useState } from 'react';
import { useIsAdmin } from '../admin';
import { DivisionTabs } from '../components/DivisionTabs';
import { PlayerEditModal } from '../components/PlayerEditModal';
import { SheetSettingsDialog } from '../components/SheetSettingsDialog';
import { Tabs, type TabItem } from '../components/Tabs';
import type { AppData } from '../data';
import { fullName, num } from '../format';
import {
  courseHandicap,
  divisionFor,
  playingHandicap,
  teeRatings,
  visibleDivisions,
} from '../scoring/engine';
import { removePlayer, upsertPlayer } from '../sheets/playersAdapter';
import { loadSheetsSettings, type SheetsSettings } from '../sheets/settings';
import type { Course, DivisionConfig, Player } from '../types';

const SUB_TABS: TabItem[] = [
  { id: 'manage', label: 'Manage' },
  { id: 'roster', label: 'By division' },
];

type Mode = { kind: 'idle' } | { kind: 'add' } | { kind: 'edit'; player: Player };

export function ManagePlayers({ data }: { data: AppData }) {
  const admin = useIsAdmin();
  const { course, players } = data;
  const [subTab, setSubTab] = useState<string>('manage');
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [pendingDelete, setPendingDelete] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    kind: 'idle' | 'ok' | 'err';
    msg?: string;
  }>({ kind: 'idle' });
  const [cfg, setCfg] = useState<SheetsSettings | null>(loadSheetsSettings());
  const [showSettings, setShowSettings] = useState(false);

  const sorted = useMemo(
    () =>
      players.slice().sort((a, b) => {
        const la = a.lastName.localeCompare(b.lastName);
        return la !== 0 ? la : a.firstName.localeCompare(b.firstName);
      }),
    [players]
  );

  if (!admin) {
    return (
      <section>
        <h1 className="text-2xl text-rd-navy mb-2">Not available</h1>
        <p className="text-sm text-rd-ink/70">Manage Players is admin-only.</p>
      </section>
    );
  }

  const requireCfg = (): SheetsSettings | null => {
    const c = loadSheetsSettings();
    if (!c) {
      setStatus({
        kind: 'err',
        msg: 'No Sheet configured. Open Settings and set Sheet ID + Apps Script URL.',
      });
      return null;
    }
    return c;
  };

  const onSavePlayer = async (player: Player) => {
    const c = requireCfg();
    if (!c) return;
    setMode({ kind: 'idle' });
    setBusy(true);
    setStatus({ kind: 'idle' });
    try {
      await upsertPlayer(c, player);
      setStatus({ kind: 'ok', msg: `Saved ${fullName(player)}.` });
      await data.reload();
    } catch (e) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    const c = requireCfg();
    if (!c) return;
    const target = pendingDelete;
    setPendingDelete(null);
    setBusy(true);
    setStatus({ kind: 'idle' });
    try {
      await removePlayer(c, target.saId);
      setStatus({ kind: 'ok', msg: `Removed ${fullName(target)}.` });
      await data.reload();
    } catch (e) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const existingSaIds = new Set(players.map((p) => p.saId));

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl text-rd-navy mb-1">Manage Players</h1>
          <p className="text-sm text-rd-ink/60">
            Add, edit, or remove players. Saving writes to the Players tab in the
            configured Google Sheet.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            className="text-sm text-rd-navy hover:underline"
            onClick={() => setShowSettings(true)}
          >
            {cfg ? 'Sheet: configured' : 'Configure Google Sheet'}
          </button>
          {subTab === 'manage' && (
            <button
              className="px-3 py-1.5 bg-rd-navy text-white rounded text-sm font-medium"
              onClick={() => setMode({ kind: 'add' })}
            >
              + Add player
            </button>
          )}
        </div>
      </div>

      <Tabs tabs={SUB_TABS} active={subTab} onChange={setSubTab} className="mb-2" />

      {status.msg && (
        <p
          className={`text-sm ${
            status.kind === 'err' ? 'text-red-700' : 'text-green-700'
          }`}
        >
          {status.msg}
        </p>
      )}

      {subTab === 'roster' ? (
        <RosterView course={course} players={players} />
      ) : (
      <div className="rd-card overflow-x-auto">
        <table className="rd-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>SA ID</th>
              <th>HI</th>
              <th>Division</th>
              <th>MP</th>
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-rd-ink/50">
                  No players yet — click <strong>+ Add player</strong> to start.
                </td>
              </tr>
            ) : (
              sorted.map((p) => {
                const division = divisionFor(p, course);
                return (
                  <tr key={p.saId}>
                    <td>{fullName(p)}</td>
                    <td className="text-rd-ink/60 tabular-nums">{p.saId}</td>
                    <td className="tabular-nums">{p.hi}</td>
                    <td>
                      {division?.name ?? '—'}
                      {p.divisionOverride && (
                        <span className="ml-1 text-xs text-rd-gold">(override)</span>
                      )}
                    </td>
                    <td>
                      {p.matchPlay === false ? (
                        <span
                          className="text-xs text-rd-ink/40"
                          title="Opted out of Match Play"
                        >
                          opt-out
                        </span>
                      ) : (
                        <span
                          className="text-xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-rd-gold/20 text-rd-navy font-semibold"
                          title="In the Match Play pool"
                        >
                          MP
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button
                        className="text-sm text-rd-navy hover:underline mr-3 disabled:opacity-50"
                        disabled={busy}
                        onClick={() => setMode({ kind: 'edit', player: p })}
                      >
                        Edit
                      </button>
                      <button
                        className="text-sm text-red-700 hover:underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() => setPendingDelete(p)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}

      {(mode.kind === 'add' || mode.kind === 'edit') && (
        <PlayerEditModal
          initial={mode.kind === 'edit' ? mode.player : null}
          existingSaIds={existingSaIds}
          busy={busy}
          onSave={onSavePlayer}
          onCancel={() => setMode({ kind: 'idle' })}
        />
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="rd-card p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl text-rd-navy mb-2">Remove player</h2>
            <p className="text-sm text-rd-ink/70 mb-2">
              Remove <strong>{fullName(pendingDelete)}</strong> from the roster?
            </p>
            <p className="text-xs text-rd-ink/50 mb-4">
              Any scores already entered for this player stay in the Scores tab
              (harmless — they just won't appear on the leaderboard).
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 text-sm rounded border border-rd-cream"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-red-700 text-white disabled:opacity-50"
                disabled={busy}
                onClick={() => void onConfirmDelete()}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

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

/**
 * Per-division roster view — alphabetic listing with computed HC and PH for
 * the active division's tee. Read-only; admins use the Manage tab to edit.
 */
function RosterView({ course, players }: { course: Course; players: Player[] }) {
  const divs = useMemo(() => visibleDivisions(course), [course]);
  const rowsByDiv = useMemo(() => {
    const map = new Map<string, RosterRow[]>();
    for (const d of divs) map.set(d.code, []);
    for (const player of players) {
      const division = divisionFor(player, course);
      if (!division) continue;
      const list = map.get(division.code);
      if (list) list.push(rosterRowFor(player, division, course));
    }
    return map;
  }, [players, course, divs]);

  const [activeDiv, setActiveDiv] = useState<string>(divs[0]?.code ?? '');
  const division = divs.find((d) => d.code === activeDiv);
  const rows = rowsByDiv.get(activeDiv) ?? [];

  const sortedRows = rows.slice().sort((a, b) => {
    const la = a.player.lastName.localeCompare(b.player.lastName);
    return la !== 0 ? la : a.player.firstName.localeCompare(b.player.firstName);
  });

  return (
    <div>
      <p className="text-sm text-rd-ink/60 mb-3">
        {players.length} entered · {division ? `${rows.length} in ${division.name}` : 'select a division'}
        {division && (
          <>
            {' · '}
            {division.hiMin > -100
              ? `HI ${division.hiMin}–${division.hiMax}`
              : `HI ≤ ${division.hiMax}`}
          </>
        )}
      </p>
      <DivisionTabs divisions={divs} active={activeDiv} onChange={setActiveDiv} />

      <div className="rd-card overflow-x-auto">
        <table className="rd-table table-fixed">
          <colgroup>
            <col style={{ width: '34%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Player</th>
              <th>SA ID</th>
              <th>HI</th>
              <th>HC</th>
              <th>PH</th>
              <th>Tee</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-rd-ink/50">
                  No players in this division.
                </td>
              </tr>
            ) : (
              sortedRows.map(({ player, hc, ph }) => (
                <tr key={player.saId}>
                  <td>
                    {fullName(player)}
                    {player.divisionOverride && (
                      <span className="ml-1 text-xs text-rd-gold">(override)</span>
                    )}
                  </td>
                  <td className="text-rd-ink/60 tabular-nums">{player.saId}</td>
                  <td>{num(player.hi, 1)}</td>
                  <td>{num(hc, 1)}</td>
                  <td>{num(ph)}</td>
                  <td className="capitalize">{division?.tee}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type RosterRow = {
  player: Player;
  hc: number | null;
  ph: number | null;
};

function rosterRowFor(player: Player, division: DivisionConfig, course: Course): RosterRow {
  const tee = course.tees[division.tee];
  const ratings = tee ? teeRatings(tee, course.gender) : undefined;
  const hc =
    tee && ratings
      ? courseHandicap(player.hi, ratings.slope, ratings.cr, tee.par, course.maxHandicap)
      : null;
  const ph = hc != null ? playingHandicap(hc, division.handicapPct) : null;
  return { player, hc, ph };
}
