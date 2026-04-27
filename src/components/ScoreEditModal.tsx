import { useEffect } from 'react';
import { fullName } from '../format';
import type { AppData } from '../data';
import type { Player } from '../types';
import { ScoreEntryPanel } from './ScoreEntryPanel';

export function ScoreEditModal({
  data,
  player,
  onClose,
}: {
  data: AppData;
  player: Player;
  onClose: () => void;
}) {
  // Close on Escape, lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-3 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="rd-card p-5 w-full max-w-3xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl text-rd-navy font-serif">
            Edit scores — {fullName(player)}
          </h2>
          <button
            className="text-sm text-rd-ink/60 hover:text-rd-navy"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <ScoreEntryPanel data={data} lockedSaId={player.saId} />
      </div>
    </div>
  );
}
