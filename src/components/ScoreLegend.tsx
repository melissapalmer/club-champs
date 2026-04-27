import { ScoreSymbol } from './ScoreSymbol';

const ITEMS: { score: number; par: number; label: string }[] = [
  { score: 1, par: 4, label: 'Albatross+' },
  { score: 2, par: 4, label: 'Eagle' },
  { score: 3, par: 4, label: 'Birdie' },
  { score: 4, par: 4, label: 'Par' },
  { score: 5, par: 4, label: 'Bogey' },
  { score: 6, par: 4, label: 'Double' },
  { score: 7, par: 4, label: 'Triple+' },
];

export function ScoreLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-rd-ink/70">
      <span className="text-rd-ink/60 font-medium">Key:</span>
      {ITEMS.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <ScoreSymbol score={it.score} par={it.par} />
          <span>{it.label}</span>
        </span>
      ))}
    </div>
  );
}
