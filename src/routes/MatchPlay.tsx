import { Bracket } from '../components/Bracket';
import type { AppData } from '../data';

export function MatchPlay({ data }: { data: AppData }) {
  const { course, players, matches } = data;
  const title = course.matchPlay?.name ?? 'Match Play';
  const enabled = !!course.matchPlay?.enabled;

  if (!enabled && matches.length === 0) {
    return (
      <section>
        <h1 className="text-2xl text-rd-navy mb-2">Match Play</h1>
        <p className="text-sm text-rd-ink/70">
          Match Play is not enabled for this event. Admin can enable it in
          Config.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">{title}</h1>
      <p className="text-sm text-rd-ink/60 mb-4">
        Knockout bracket — single elimination.
      </p>
      {matches.length === 0 ? (
        <div className="rd-card p-6 text-center text-sm text-rd-ink/60">
          Bracket not yet generated — admin can generate it in Config.
        </div>
      ) : (
        <Bracket matches={matches} players={players} />
      )}
    </section>
  );
}
