/**
 * Generic horizontal tab strip — same visual style as the per-page
 * `DivisionTabs` (gold underline on the active tab). Used for any
 * "switch between sub-views" flow that isn't division-keyed.
 */
export type TabItem = { id: string; label: string };

export function Tabs({
  tabs,
  active,
  onChange,
  className = 'mb-4',
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex border-b border-rd-cream ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`rd-tab ${active === t.id ? 'rd-tab-active' : ''}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
