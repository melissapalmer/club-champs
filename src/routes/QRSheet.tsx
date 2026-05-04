import { useEffect, useState } from 'react';
import { useIsAdmin } from '../admin';
import { getEntryUrls, siteBaseUrl, type EntryUrls } from '../auth/entryTokens';
import { EntryQRSheet } from '../components/EntryQRSheet';
import type { AppData } from '../data';
import { loadSheetsSettings } from '../sheets/settings';
import { resolveAssetUrl } from '../theme';

/**
 * Standalone /qr-sheet route — renders OUTSIDE the main Layout (no header,
 * no nav) so the page is clean for printing. Admin opens it via "Print QR
 * sheet" in Config → Score Entry, which calls window.open('#/qr-sheet').
 *
 * Each new tab fetches its own getEntryUrls — localStorage carries the
 * admin's cfg across tabs of the same origin, so no state plumbing needed.
 */
export function QRSheet({ data }: { data: AppData }) {
  const admin = useIsAdmin();
  const [urls, setUrls] = useState<EntryUrls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;
    const cfg = loadSheetsSettings();
    if (!cfg) {
      setError(
        'No Sheet config in this browser. Open the main site, configure Sheet settings, and re-open this tab.'
      );
      return;
    }
    getEntryUrls(cfg, siteBaseUrl())
      .then(setUrls)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [admin]);

  if (!admin) {
    return (
      <div className="p-6">
        <h1 className="text-xl text-rd-navy">Admin only</h1>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 text-red-700">
        <h1 className="text-xl mb-2">Couldn’t load QR sheet</h1>
        <p className="text-sm">{error}</p>
      </div>
    );
  }
  if (!urls) {
    return <p className="p-6 text-rd-ink/60">Loading…</p>;
  }
  const logoUrl =
    resolveAssetUrl(data.course.branding?.logoUrl) ??
    resolveAssetUrl('royal-durban-logo.webp') ??
    undefined;

  return (
    <EntryQRSheet
      groups={urls.groups}
      club={data.course.club}
      event={data.course.event}
      logoUrl={logoUrl}
      onClose={() => window.close()}
    />
  );
}
