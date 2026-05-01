import { NavLink, Outlet } from 'react-router-dom';
import { useIsAdmin } from '../admin';
import { resolveAssetUrl } from '../theme';
import type { Course, Match, TeeTime } from '../types';

type NavCtx = { course: Course | null; teeTimes: TeeTime[]; matches: Match[] };

type NavItem = {
  to: string;
  label: string;
  end: boolean;
  adminOnly?: boolean;
  /** When set, this nav item is only shown if the predicate is true. */
  visibleWhen?: (ctx: NavCtx) => boolean;
};

// Score Entry is intentionally not in the public nav — reach it via the
// bookmarked URL with the access key (see /enter route). Config is visible
// only when admin mode is active in this browser session.
const NAV: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  {
    to: '/tee-times',
    label: 'Tee Times',
    end: false,
    // Show the tab if the admin enabled it OR if any tee times have actually
    // been generated — that way an admin who clicked Generate but forgot to
    // save the Course flag still gets the menu, and so does any browser that
    // sees data in the Sheet without the flag flipped (legacy / mid-flight).
    visibleWhen: ({ course, teeTimes }) =>
      !!course?.teeTimes?.enabled || teeTimes.length > 0,
  },
  { to: '/scores', label: 'Scores', end: false },
  { to: '/eclectic', label: 'Eclectic', end: false },
  { to: '/results', label: 'Results', end: false },
  {
    to: '/match-play',
    label: 'Match Play',
    end: false,
    visibleWhen: ({ course, matches }) =>
      !!course?.matchPlay?.enabled || matches.length > 0,
  },
  { to: '/players', label: 'Players', end: false, adminOnly: true },
  { to: '/manage-players', label: 'Manage Players', end: false, adminOnly: true },
  { to: '/config', label: 'Config', end: false, adminOnly: true },
];

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function Layout({
  course,
  teeTimes = [],
  matches = [],
  lastChanged = null,
}: {
  course: Course | null;
  teeTimes?: TeeTime[];
  matches?: Match[];
  lastChanged?: Date | null;
}) {
  const admin = useIsAdmin();
  const ctx: NavCtx = { course, teeTimes, matches };
  const items = NAV.filter(
    (item) =>
      (!item.adminOnly || admin) &&
      (item.visibleWhen == null || item.visibleWhen(ctx))
  );
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-rd-navy text-white print-color-exact">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center gap-4">
          <img
            src={resolveAssetUrl(course?.branding?.logoUrl) ?? resolveAssetUrl('royal-durban-logo.webp')}
            alt={course?.club ?? 'Club logo'}
            className="h-14 w-auto shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="min-w-0">
            <div className="font-serif text-xl sm:text-2xl leading-tight text-rd-gold-light">
              {course?.club ?? 'Royal Durban Golf Club'}
            </div>
            <div className="text-sm sm:text-base text-white/85 truncate">
              {course?.event ?? '2026 Ladies Club Champs'}
            </div>
          </div>
        </div>
        <nav className="bg-rd-navy-deep print:hidden">
          <div className="max-w-7xl mx-auto px-2 flex flex-wrap">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-4 py-3 text-sm font-medium border-b-2 ${
                    isActive
                      ? 'border-rd-gold text-white'
                      : 'border-transparent text-white/70 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-rd-cream text-xs text-rd-ink/60 py-4 text-center">
        <div>
          {course?.club ?? 'Royal Durban Golf Club'} · {course?.event ?? '2026 Ladies Club Champs'}
        </div>
        {lastChanged && (
          <div className="text-rd-ink/40 mt-0.5 print-hidden">
            Updated at {formatTime(lastChanged)}
          </div>
        )}
      </footer>
    </div>
  );
}
