import { NavLink } from 'react-router-dom';
import type { AppData } from '../data';
import { visibleDivisions } from '../scoring/engine';

type Card = { to: string; title: string; desc: string };

export function Home({ data }: { data: AppData }) {
  const { course, players, teeTimes } = data;
  const divs = visibleDivisions(course);

  const hasStableford = divs.some((d) => d.format === 'stableford');
  const hasMedal = divs.some((d) => (d.format ?? 'medal') === 'medal');
  const formatLabel =
    hasStableford && hasMedal ? 'medal + stableford' : hasStableford ? 'stableford' : 'medal';

  const teeTimesShown = !!course.teeTimes?.enabled || teeTimes.length > 0;
  const teeTimesStarts =
    course.teeTimes?.enabled && course.teeTimes.day1Start && course.teeTimes.day2Start
      ? `Sat ${course.teeTimes.day1Start} · Sun ${course.teeTimes.day2Start}`
      : null;
  const matchPlayShown =
    course.divisions.some((d) => d.matchPlay?.enabled) || data.matches.length > 0;

  const cards: Card[] = [
    teeTimesShown && {
      to: '/tee-times',
      title: 'Tee Times',
      desc: "Who's playing with whom and at what time.",
    },
    {
      to: '/scores',
      title: 'Scores',
      desc: 'Leaderboard division-by-division.',
    },
    {
      to: '/eclectic',
      title: 'Eclectic',
      desc: 'Best score per hole across both rounds.',
    },
    {
      to: '/results',
      title: 'Results',
      desc: 'Prize winners by division and category.',
    },
    matchPlayShown && {
      to: '/match-play',
      title: 'Match Play',
      desc: 'Knockout brackets per division.',
    },
  ].filter(Boolean) as Card[];

  return (
    <section>
      <h1 className="text-2xl text-rd-navy mb-1">Welcome to {course.event}</h1>
      <p className="text-sm text-rd-ink/60 mb-4">
        Tee times, scores and results.
      </p>

      <div className="rd-card p-4 mb-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-rd-ink/60">Divisions:</span>{' '}
            <span className="font-semibold text-rd-navy">{divs.length}</span>
          </div>
          <div>
            <span className="text-rd-ink/60">Players:</span>{' '}
            <span className="font-semibold text-rd-navy">{players.length}</span>
          </div>
          <div>
            <span className="text-rd-ink/60">Format:</span>{' '}
            <span className="font-semibold text-rd-navy">{formatLabel}</span>
          </div>
          {teeTimesStarts && (
            <div>
              <span className="text-rd-ink/60">Tee off:</span>{' '}
              <span className="font-semibold text-rd-navy">{teeTimesStarts}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c) => (
          <NavLink
            key={c.to}
            to={c.to}
            className="rd-card p-4 hover:shadow-md transition-shadow block"
          >
            <h2 className="text-lg text-rd-navy font-semibold mb-1">{c.title}</h2>
            <p className="text-sm text-rd-ink/70">{c.desc}</p>
          </NavLink>
        ))}
      </div>
    </section>
  );
}
