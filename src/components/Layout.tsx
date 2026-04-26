import { NavLink, Outlet } from 'react-router-dom';
import type { Course } from '../types';

const NAV = [
  { to: '/', label: 'Leaderboard', end: true },
  { to: '/eclectic', label: 'Eclectic', end: false },
  { to: '/results', label: 'Results', end: false },
  { to: '/players', label: 'Players', end: false },
  { to: '/enter', label: 'Score Entry', end: false },
];

export function Layout({ course }: { course: Course | null }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-rd-navy text-white">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center gap-4">
          <img
            src={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/royal-durban-logo.webp`}
            alt="Royal Durban Golf Club"
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
        <nav className="bg-rd-navy-deep">
          <div className="max-w-6xl mx-auto px-2 flex flex-wrap">
            {NAV.map((item) => (
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
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-rd-cream text-xs text-rd-ink/60 py-4 text-center">
        Royal Durban GC · 2026 Ladies Club Champs
      </footer>
    </div>
  );
}
