import { useState } from 'react';
import {
  clearGitHubSettings,
  type GitHubSettings,
} from '../github';

export function GitHubSettingsDialog({
  initial,
  onSave,
  onCancel,
}: {
  initial: GitHubSettings | null;
  onSave: (s: GitHubSettings) => void;
  onCancel: () => void;
}) {
  const [owner, setOwner] = useState(initial?.owner ?? '');
  const [repo, setRepo] = useState(initial?.repo ?? '');
  const [branch, setBranch] = useState(initial?.branch ?? 'main');
  const [pat, setPat] = useState(initial?.pat ?? '');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="rd-card p-5 w-full max-w-md">
        <h2 className="text-xl text-rd-navy mb-3">GitHub settings</h2>
        <p className="text-sm text-rd-ink/70 mb-4">
          Used so admin pages can commit data files directly. Token stays in this
          browser. Use a <em>fine-grained PAT</em> scoped to this repo with{' '}
          <strong>Contents: Read &amp; Write</strong>.
        </p>
        <label className="block mb-3">
          <span className="text-sm font-medium">Owner</span>
          <input
            className="w-full border rounded px-2 py-1 mt-1"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="your-github-username"
          />
        </label>
        <label className="block mb-3">
          <span className="text-sm font-medium">Repo</span>
          <input
            className="w-full border rounded px-2 py-1 mt-1"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="club-champs"
          />
        </label>
        <label className="block mb-3">
          <span className="text-sm font-medium">Branch</span>
          <input
            className="w-full border rounded px-2 py-1 mt-1"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          />
        </label>
        <label className="block mb-4">
          <span className="text-sm font-medium">Personal Access Token</span>
          <input
            type="password"
            className="w-full border rounded px-2 py-1 mt-1 font-mono text-sm"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder="github_pat_..."
          />
        </label>
        <div className="flex justify-between">
          <button
            className="text-sm text-red-700 hover:underline"
            onClick={() => {
              clearGitHubSettings();
              onCancel();
            }}
          >
            Forget token
          </button>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-sm rounded border border-rd-cream"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded bg-rd-navy text-white disabled:opacity-50"
              disabled={!owner || !repo || !pat}
              onClick={() => onSave({ owner, repo, branch: branch || 'main', pat })}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
