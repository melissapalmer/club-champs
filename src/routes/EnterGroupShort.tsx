import { Navigate, useParams } from 'react-router-dom';

/**
 * Compact group-entry URL `/g/D1-0800-XKB97R` → redirects to the long-form
 * `/enter-group?day=1&time=08:00&t=XKB97R`. The compact form is what's
 * printed on the QR sheet so markers can hand-type it if scanning fails.
 *
 * Slug grammar: `D{day}-{HHMM}-{TOKEN}`
 *   day:   1 or 2
 *   HHMM:  4-digit 24h time, e.g. 0800
 *   TOKEN: 6-char readable token (alphabet excludes 0/O/1/I)
 */
export function EnterGroupShort() {
  const { slug = '' } = useParams<{ slug: string }>();
  const m = slug.match(/^D([12])-(\d{4})-([A-Za-z0-9]+)$/);
  if (!m) {
    return (
      <section>
        <h1 className="text-2xl text-rd-navy mb-2">Link not recognised</h1>
        <p className="text-sm text-rd-ink/70">
          The link should look like <code>…/#/g/D1-0800-XKB97R</code>. Check
          the printed sheet, or ask the organiser for the QR code.
        </p>
      </section>
    );
  }
  const day = m[1];
  const hhmm = m[2];
  const time = `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
  // Token comes in as user-typed; uppercase it for the canonical form so a
  // marker who types lowercase still hits the right token server-side.
  const token = m[3].toUpperCase();
  const target = `/enter-group?day=${day}&time=${encodeURIComponent(time)}&t=${encodeURIComponent(token)}`;
  return <Navigate to={target} replace />;
}
