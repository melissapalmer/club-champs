import { Navigate, useParams } from 'react-router-dom';

/**
 * Compact per-player magic link `/p/{saId}-{TOKEN}` → redirects to the long-
 * form `/enter?saId={saId}&t={TOKEN}`. The compact form is what's shipped
 * to players via WhatsApp / email so the URL can also be hand-typed if a
 * player struggles with link-tap on their phone.
 *
 * Slug grammar: `{saId}-{TOKEN}` where saId is digits and TOKEN is the
 * 6-char readable form (alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`).
 */
export function EnterShort() {
  const { slug = '' } = useParams<{ slug: string }>();
  const m = slug.match(/^(\d+)-([A-Za-z0-9]+)$/);
  if (!m) {
    return (
      <section>
        <h1 className="text-2xl text-rd-navy mb-2">Link not recognised</h1>
        <p className="text-sm text-rd-ink/70">
          The link should look like <code>…/#/p/2700438384-XKB97R</code>.
          Check the message you received, or ask the organiser for a fresh link.
        </p>
      </section>
    );
  }
  const saId = m[1];
  const token = m[2].toUpperCase();
  const target = `/enter?saId=${encodeURIComponent(saId)}&t=${encodeURIComponent(token)}`;
  return <Navigate to={target} replace />;
}
