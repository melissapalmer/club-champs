import { fullName } from '../format';
import { matchesByRound, pairingOrder, roundLabel } from '../scoring/matchPlay';
import type { Match, Player } from '../types';

/**
 * Single-elimination bracket renderer styled like the Golf Genius reference:
 * one column per round, player cards stacked, vertical alignment lines up
 * each match with the midpoint of its two feeders. Pure CSS — flexbox
 * columns with progressively wider gaps.
 *
 * Players display by saId lookup against the live `players` list (so
 * renames flow through without regenerating). Falls back to the saId in
 * muted text if the player has been removed.
 */
export function Bracket({
  matches,
  players,
}: {
  matches: Match[];
  players: Player[];
}) {
  if (matches.length === 0) return null;

  const playerById = new Map(players.map((p) => [p.saId, p]));
  const seedBySaId = computeSeedMap(matches);
  const rounds = matchesByRound(matches);
  const totalRounds = rounds.length;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max items-stretch">
        {rounds.map((roundMatches, idx) => (
          <div
            key={idx}
            className="flex flex-col justify-around min-w-[14rem]"
            style={{
              // Each subsequent round's gap doubles so matches align with the
              // midpoint of their two feeders. baseGap = 1rem.
              rowGap: `${(1 << idx) * 1}rem`,
            }}
          >
            <div className="text-xs uppercase tracking-wide text-rd-ink/60 font-semibold mb-1">
              {roundLabel(idx + 1, totalRounds)}
            </div>
            <div
              className="flex flex-col"
              style={{ rowGap: `${(1 << idx) * 1}rem` }}
            >
              {roundMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  playerById={playerById}
                  seedBySaId={seedBySaId}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Map a player saId to their seed number based on the round-1 slot they
 * appear in. Uses the standard pairing order so seeding is recoverable
 * from the persisted bracket without re-running the engine.
 *
 * Round-1 slot s pairs seeds at indices `pairingOrder(N)[2s]` and
 * `pairingOrder(N)[2s+1]`. We invert that map. If the bracket size isn't
 * a power of 2 (e.g. stale data), `pairingOrder` returns `[]` and we
 * silently skip seed labels — bracket still renders without them.
 */
function computeSeedMap(matches: Match[]): Map<string, number> {
  const round1 = matches.filter((m) => m.round === 1).sort((a, b) => a.slot - b.slot);
  const out = new Map<string, number>();
  if (round1.length === 0) return out;
  const N = round1.length * 2;
  const order = pairingOrder(N);
  if (order.length !== N) return out;
  round1.forEach((m, idx) => {
    const seedA = order[2 * idx];
    const seedB = order[2 * idx + 1];
    if (m.playerASaId && seedA != null) out.set(m.playerASaId, seedA);
    if (m.playerBSaId && seedB != null) out.set(m.playerBSaId, seedB);
  });
  return out;
}

function MatchCard({
  match,
  playerById,
  seedBySaId,
}: {
  match: Match;
  playerById: Map<string, Player>;
  seedBySaId: Map<string, number>;
}) {
  const isBye = match.result === 'bye';
  return (
    <div className="rd-card border border-rd-cream w-56 overflow-hidden">
      <PlayerRow
        saId={match.playerASaId}
        playerById={playerById}
        seedBySaId={seedBySaId}
        won={match.winnerSaId != null && match.winnerSaId === match.playerASaId}
        isOtherSideBye={isBye && !match.playerASaId}
        result={match.result}
      />
      <div className="border-t border-rd-cream" />
      <PlayerRow
        saId={match.playerBSaId}
        playerById={playerById}
        seedBySaId={seedBySaId}
        won={match.winnerSaId != null && match.winnerSaId === match.playerBSaId}
        isOtherSideBye={isBye && !match.playerBSaId}
        result={match.result}
      />
    </div>
  );
}

function PlayerRow({
  saId,
  playerById,
  seedBySaId,
  won,
  isOtherSideBye,
  result,
}: {
  saId: string | undefined;
  playerById: Map<string, Player>;
  seedBySaId: Map<string, number>;
  won: boolean;
  isOtherSideBye: boolean;
  result: string | undefined;
}) {
  if (!saId) {
    // Empty slot: either a bye on the OTHER side, or a future-round placeholder.
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-rd-ink/40 italic">
        {isOtherSideBye ? <span>BYE</span> : <span>—</span>}
      </div>
    );
  }
  const player = playerById.get(saId);
  const seed = seedBySaId.get(saId);
  const display = player ? fullName(player) : `(${saId})`;
  return (
    <div
      className={`flex items-baseline gap-2 px-2 py-1.5 text-sm ${
        won ? 'bg-rd-gold/15 font-semibold' : ''
      }`}
    >
      {seed != null && (
        <span className="text-[10px] text-rd-ink/50 font-semibold tabular-nums w-4">
          {seed}
        </span>
      )}
      <span className={`flex-1 truncate ${won ? 'text-rd-navy' : 'text-rd-ink'}`}>
        {display}
      </span>
      {won && result && result !== 'bye' && (
        <span className="text-[10px] text-rd-ink/60 italic whitespace-nowrap">
          {result}
        </span>
      )}
    </div>
  );
}
