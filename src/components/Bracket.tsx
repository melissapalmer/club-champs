import { fullName } from '../format';
import { matchesByRound, pairingOrder, roundLabel } from '../scoring/matchPlay';
import type { Match, Player } from '../types';

/**
 * Single-elimination bracket renderer styled after the Golf Genius reference:
 *   - shared header row across all round columns
 *   - dark navy player rows with a right-pointing "flag" arrow indicating
 *     which player advances to the next column
 *   - winner gets a gold accent strip on the left
 *   - bye rows reuse the same shape as named rows so the UI stays uniform
 *
 * Pure CSS; no JS measurement. Matches align vertically using progressively
 * doubled row gaps (so each round-2 match centres between its two feeders).
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

  // Champion = winner of the final. Renders as one extra column at the right.
  const finalMatch = rounds[totalRounds - 1]?.[0];
  const championSaId = finalMatch?.winnerSaId;

  // Row count for the bracket grid: 1 row per round-1 slot. Deeper rounds
  // span 2^R rows so they centre between their two feeders.
  const round1Slots = rounds[0]?.length ?? 0;
  const totalGridRows = round1Slots;

  return (
    <div className="overflow-x-auto pb-4 print-color-exact">
      <div
        className="grid gap-x-6 gap-y-3"
        style={{
          gridTemplateColumns: `repeat(${rounds.length + 1}, 14rem)`,
          // Header row + one row per round-1 slot. Match rows are auto-sized
          // by their content (one MatchCard each); deeper rounds span more
          // rows but centre vertically within their span.
          gridTemplateRows: `auto repeat(${totalGridRows}, auto)`,
        }}
      >
        {/* Header row across all columns. */}
        {rounds.map((_, idx) => (
          <div
            key={`h-${idx}`}
            className="text-xs uppercase tracking-wide text-rd-ink/60 font-semibold text-center bg-rd-navy/5 py-2 rounded"
            style={{ gridColumn: idx + 1, gridRow: 1 }}
          >
            {roundLabel(idx + 1, totalRounds)}
          </div>
        ))}
        <div
          className="text-xs uppercase tracking-wide text-rd-navy font-semibold text-center bg-rd-gold/20 py-2 rounded"
          style={{ gridColumn: rounds.length + 1, gridRow: 1 }}
        >
          Champion
        </div>

        {/* Match cards. Each round-R match (1-indexed) spans 2^(R-1) grid
            rows starting at slot * 2^(R-1) + 1, and centres vertically — so
            a round-2 match sits exactly between its two round-1 feeders. */}
        {rounds.flatMap((roundMatches, roundIdx) =>
          roundMatches.map((m) => {
            const span = 1 << roundIdx; // 1, 2, 4, …
            const start = m.slot * span + 2; // +2 because row 1 is the header
            return (
              <div
                key={`${m.divisionCode}-${m.id}`}
                className="self-center"
                style={{
                  gridColumn: roundIdx + 1,
                  gridRowStart: start,
                  gridRowEnd: start + span,
                }}
              >
                <MatchCard
                  match={m}
                  playerById={playerById}
                  seedBySaId={seedBySaId}
                />
              </div>
            );
          })
        )}

        {/* Champion column — spans all match rows, vertically centred. */}
        <div
          className="self-center"
          style={{
            gridColumn: rounds.length + 1,
            gridRowStart: 2,
            gridRowEnd: 2 + totalGridRows,
          }}
        >
          <ChampionCard
            saId={championSaId}
            playerById={playerById}
            seedBySaId={seedBySaId}
            result={finalMatch?.result}
          />
        </div>
      </div>
    </div>
  );
}

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
    <div className="relative">
      <div className="flex flex-col bg-rd-navy text-white text-sm">
        <PlayerRow
          saId={match.playerASaId}
          playerById={playerById}
          seedBySaId={seedBySaId}
          won={match.winnerSaId != null && match.winnerSaId === match.playerASaId}
          isOtherSideBye={isBye && !match.playerASaId}
          result={match.result}
        />
        <div className="border-t-4 border-white/30" aria-hidden="true" />
        <PlayerRow
          saId={match.playerBSaId}
          playerById={playerById}
          seedBySaId={seedBySaId}
          won={match.winnerSaId != null && match.winnerSaId === match.playerBSaId}
          isOtherSideBye={isBye && !match.playerBSaId}
          result={match.result}
        />
      </div>
      {/* Single right-pointing arrow spanning both player rows. */}
      <div
        className="absolute -right-3 top-0 bottom-0 w-3 bg-rd-navy"
        style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Final winner of the bracket, rendered as a single gold-themed card in the
 * extra "Champion" column at the right edge. Shows "TBD" while the final is
 * unresolved so the column still occupies its space and the bracket grid
 * stays uniform.
 */
function ChampionCard({
  saId,
  playerById,
  seedBySaId,
  result,
}: {
  saId: string | undefined;
  playerById: Map<string, Player>;
  seedBySaId: Map<string, number>;
  result: string | undefined;
}) {
  const player = saId ? playerById.get(saId) : undefined;
  const seed = saId ? seedBySaId.get(saId) : undefined;
  const display = !saId
    ? 'TBD'
    : player
      ? fullName(player)
      : `(${saId})`;
  return (
    <div className="flex items-stretch text-sm text-rd-navy bg-rd-gold/30 border border-rd-gold rounded">
      <span className="px-2 py-2 bg-rd-gold/50 tabular-nums text-xs flex items-center justify-center min-w-[2rem] font-semibold">
        {seed != null ? seed : ''}
      </span>
      <span
        className={`flex-1 px-2 py-2 font-semibold ${!saId ? 'italic text-rd-navy/40' : ''}`}
      >
        {display}
      </span>
      {saId && result && result !== 'bye' && (
        <span className="px-2 py-2 text-[10px] italic text-rd-navy/70 whitespace-nowrap self-center">
          {result}
        </span>
      )}
    </div>
  );
}

/**
 * One player row inside a MatchCard. Layout:
 *   [seed cell · darker bg]  [name · flexes to fill]  [result · right-aligned, only for winner]
 * The MatchCard wraps both rows in a single container with one shared
 * arrow flag, so this row no longer paints its own bg or arrow.
 * Winner is shown by bolding the name (the row bg can't differ without
 * breaking the unified arrow silhouette).
 */
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
  const player = saId ? playerById.get(saId) : undefined;
  const seed = saId ? seedBySaId.get(saId) : undefined;
  const display = !saId
    ? isOtherSideBye
      ? 'Bye'
      : 'TBD'
    : player
      ? fullName(player)
      : `(${saId})`;

  return (
    <div className="flex items-stretch">
      <span className="px-2 py-1.5 bg-black/20 tabular-nums text-xs flex items-center justify-center min-w-[2rem]">
        {seed != null ? seed : ''}
      </span>
      <span
        className={`flex-1 px-2 py-1.5 truncate ${
          !saId ? 'text-white/50 italic' : won ? 'font-semibold' : ''
        }`}
      >
        {display}
      </span>
      {won && result && result !== 'bye' && (
        <span className="px-2 py-1.5 text-[10px] italic text-white/80 whitespace-nowrap">
          {result}
        </span>
      )}
    </div>
  );
}
