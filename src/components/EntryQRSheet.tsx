import QRCode from 'qrcode-svg';
import { useMemo, useState } from 'react';

type GroupRow = {
  day: number;
  time: string;
  names: string[];
  url: string;
};

type PrintMode = 'all' | 'day1' | 'day2';

/**
 * Render an SVG QR code at a fixed size. The QR itself stays plain black on
 * a white quiet-zone — tinting pixels or shrinking the white margin drops
 * scan reliability, especially in low light at the tee.
 *
 * Branding goes around the QR (header strip, accent lines, typography),
 * never on top of the matrix.
 */
function QRImage({ value, size = 160 }: { value: string; size?: number }) {
  const svg = useMemo(
    () =>
      new QRCode({
        content: value,
        padding: 2,
        width: size,
        height: size,
        ecl: 'M',
      }).svg(),
    [value, size]
  );
  return (
    <span
      className="block bg-white p-1"
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label="QR code"
    />
  );
}

export function EntryQRSheet({
  groups,
  club,
  event,
  logoUrl,
  onClose,
}: {
  groups: GroupRow[];
  club: string;
  event: string;
  logoUrl?: string;
  onClose: () => void;
}) {
  const day1 = groups.filter((g) => g.day === 1);
  const day2 = groups.filter((g) => g.day === 2);
  const [printMode, setPrintMode] = useState<PrintMode>('all');

  const printDay = (mode: PrintMode) => {
    setPrintMode(mode);
    // Let React commit the print:hidden class before opening the dialog,
    // then reset after the dialog closes (window.print returns synchronously
    // once the user clicks Print or Cancel).
    setTimeout(() => {
      window.print();
      setPrintMode('all');
    }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-rd-cream overflow-y-auto print:bg-white">
      <div className="max-w-5xl mx-auto p-6 print:p-0">
        <div className="flex items-center justify-between mb-4 print:hidden gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-rd-navy">
            QR sheet · {day1.length} + {day2.length} groups
          </h2>
          <div className="flex gap-2 flex-wrap">
            <button
              className="px-3 py-1.5 text-sm rounded bg-rd-navy text-white"
              onClick={() => printDay('day1')}
              disabled={day1.length === 0}
            >
              Print Day 1
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded bg-rd-navy text-white"
              onClick={() => printDay('day2')}
              disabled={day2.length === 0}
            >
              Print Day 2
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded border border-rd-navy/40 text-rd-navy"
              onClick={() => printDay('all')}
              disabled={day1.length + day2.length === 0}
            >
              Print all
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded border border-rd-navy/30 text-rd-navy"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {day1.length + day2.length === 0 ? (
          <p className="text-sm text-rd-ink/70">
            No tee times found. Generate the draw in Config → Tee Times first.
          </p>
        ) : (
          <>
            <DaySection
              dayLabel="Day 1 — Saturday"
              groups={day1}
              club={club}
              event={event}
              logoUrl={logoUrl}
              printHidden={printMode === 'day2'}
              emptyMsg="Day 1 tee times not generated yet. Generate them in Config → Tee Times."
            />
            <DaySection
              dayLabel="Day 2 — Sunday"
              groups={day2}
              club={club}
              event={event}
              logoUrl={logoUrl}
              printHidden={printMode === 'day1'}
              breakBefore
              emptyMsg="Day 2 tee times not generated yet. Generate them in Config → Tee Times after Day 1 ends, then refresh this tab."
            />
          </>
        )}
      </div>
    </div>
  );
}

function DaySection({
  dayLabel,
  groups,
  club,
  event,
  logoUrl,
  printHidden,
  breakBefore,
  emptyMsg,
}: {
  dayLabel: string;
  groups: GroupRow[];
  club: string;
  event: string;
  logoUrl?: string;
  printHidden: boolean;
  breakBefore?: boolean;
  emptyMsg: string;
}) {
  return (
    <section
      className={`mb-8 print:mb-0 ${printHidden ? 'print:hidden' : ''} ${
        breakBefore ? 'print:break-before-page' : ''
      }`}
    >
      <h2 className="text-lg font-serif text-rd-navy mb-3 pb-1 border-b border-rd-navy/30 print:text-base">
        {dayLabel}
        <span className="ml-2 text-sm text-rd-ink/60 font-sans">
          · {groups.length} group{groups.length === 1 ? '' : 's'}
        </span>
      </h2>

      {groups.length === 0 ? (
        <p className="text-sm text-rd-ink/60 italic">{emptyMsg}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3 print-color-exact">
          {groups.map((g) => (
            <GroupCard key={`${g.day}-${g.time}`} group={g} club={club} event={event} logoUrl={logoUrl} />
          ))}
        </div>
      )}
    </section>
  );
}

function GroupCard({
  group: g,
  club,
  event,
  logoUrl,
}: {
  group: GroupRow;
  club: string;
  event: string;
  logoUrl?: string;
}) {
  return (
    <article className="bg-white border border-rd-navy/30 rounded overflow-hidden break-inside-avoid print:rounded-none print:shadow-none shadow-sm">
      {/* Branded header strip — navy + gold accent — print-color-exact
          so colour survives the print dialog. */}
      <header className="bg-rd-navy text-white px-3 py-2 print-color-exact">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              className="h-8 w-auto shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-serif text-base leading-tight text-rd-gold-light truncate">
              {club}
            </div>
            <div className="text-[11px] text-white/85 truncate">{event}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wide text-rd-gold-light">
              Day {g.day}
            </div>
            <div className="text-lg font-semibold tabular-nums leading-tight">
              {g.time}
            </div>
          </div>
        </div>
      </header>
      <div className="h-1 bg-rd-gold print-color-exact" />

      <div className="p-3 flex items-start gap-3">
        <QRImage value={g.url} size={160} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-rd-ink/60 mb-1">
            Group
          </div>
          <ul className="text-sm leading-snug space-y-0.5">
            {g.names.map((n, i) => (
              <li key={i} className="text-rd-ink truncate">
                {n}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="px-3 pb-3 -mt-1">
        <div className="text-[9px] uppercase tracking-wide text-rd-ink/50 mb-0.5">
          Or type this URL
        </div>
        <UrlDisplay url={g.url} />
      </div>
    </article>
  );
}

/**
 * Compact-form URL display that highlights the typeable part. URLs from
 * Apps Script look like `https://example.com/club-champs/#/g/D1-0800-XKB97R`;
 * we de-emphasise the boilerplate prefix and bold the slug so a marker
 * hand-typing it can find their place quickly.
 */
function UrlDisplay({ url }: { url: string }) {
  const marker = '#/g/';
  const idx = url.indexOf(marker);
  if (idx === -1) {
    return (
      <p className="font-mono text-xs leading-tight text-rd-ink/70 break-all">
        {url}
      </p>
    );
  }
  const base = url.slice(0, idx);
  const slug = url.slice(idx + marker.length);
  return (
    <p className="font-mono text-xs leading-snug break-all">
      <span className="text-rd-ink/60">{base}</span>
      <span className="text-rd-ink/60">{marker}</span>
      <strong className="text-rd-navy text-sm">{slug}</strong>
    </p>
  );
}
