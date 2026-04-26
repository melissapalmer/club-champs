import type { DivisionConfig } from '../types';

export function DivisionTabs({
  divisions,
  active,
  onChange,
}: {
  divisions: DivisionConfig[];
  active: string;
  onChange: (code: string) => void;
}) {
  return (
    <div className="flex border-b border-rd-cream mb-4">
      {divisions.map((d) => (
        <button
          key={d.code}
          onClick={() => onChange(d.code)}
          className={`rd-tab ${active === d.code ? 'rd-tab-active' : ''}`}
        >
          {d.name}
        </button>
      ))}
    </div>
  );
}
