import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
    // Always visible once course data has loaded. The page itself shows a
    // "coming soon" message when no rows exist yet, so users always have
    // somewhere to go to check whether the draw is up.
    visibleWhen: ({ course }) => course != null,
  },
  { to: '/scores', label: 'Scores', end: false },
  { to: '/stats', label: 'Stats', end: false },
  { to: '/results', label: 'Prize Winners', end: false },
  {
    to: '/match-play',
    label: 'Match Play',
    end: false,
    // Temporarily hidden from public nav while seeding is being worked on —
    // admin can still reach /match-play directly via the URL or via Config.
    // Re-enable by switching this back to:
    //   visibleWhen: ({ course }) =>
    //     !!course?.divisions?.some((d) => d.matchPlay?.enabled),
    visibleWhen: () => false,
  },
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
  const { pathname } = useLocation();
  // Hide the site nav on the token-gated entry routes — these are reached
  // only via QR / magic link by players or markers, who shouldn't see the
  // spectator nav. Admin /enter (with the access key set) still gets the
  // nav for parity with the dashboard flow.
  const hideNav =
    pathname.startsWith('/enter-group') ||
    pathname.startsWith('/enter-all') ||
    pathname.startsWith('/g/') ||
    pathname.startsWith('/p/') ||
    (pathname.startsWith('/enter') && !admin);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-rd-navy text-white print-color-exact">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center gap-4 print:py-2">
          <img
            src={resolveAssetUrl(course?.branding?.logoUrl) ?? resolveAssetUrl('royal-durban-logo.webp')}
            alt={course?.club ?? 'Club logo'}
            className="h-14 w-auto shrink-0 print:h-8"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="min-w-0">
            <div className="font-serif text-xl sm:text-2xl leading-tight text-rd-gold-light print:text-base">
              {course?.club ?? 'Royal Durban Golf Club'}
            </div>
            <div className="text-sm sm:text-base text-white/85 truncate print:text-xs">
              {course?.event ?? '2026 Ladies Club Champs'}
            </div>
          </div>
        </div>
        {!hideNav && (
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
        )}
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-rd-cream text-xs text-rd-ink/60 py-4 text-center print:hidden">
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
