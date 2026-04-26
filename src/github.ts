const SETTINGS_KEY = 'rd-cc-github';

export type GitHubSettings = {
  owner: string;
  repo: string;
  branch: string;
  pat: string;
};

export function loadGitHubSettings(): GitHubSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GitHubSettings>;
    if (!parsed.owner || !parsed.repo || !parsed.pat) return null;
    return {
      owner: parsed.owner,
      repo: parsed.repo,
      branch: parsed.branch || 'main',
      pat: parsed.pat,
    };
  } catch {
    return null;
  }
}

export function saveGitHubSettings(s: GitHubSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function clearGitHubSettings(): void {
  localStorage.removeItem(SETTINGS_KEY);
}

const API = 'https://api.github.com';

async function getFileSha(s: GitHubSettings, path: string): Promise<string | null> {
  const url = `${API}/repos/${s.owner}/${s.repo}/contents/${path}?ref=${s.branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${s.pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

export async function commitFile(
  s: GitHubSettings,
  path: string,
  content: string,
  message: string
): Promise<void> {
  const sha = await getFileSha(s, path);
  const url = `${API}/repos/${s.owner}/${s.repo}/contents/${path}`;
  // Use TextEncoder + btoa over a binary string to handle any non-ASCII.
  const bytes = new TextEncoder().encode(content);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const body = {
    message,
    content: btoa(bin),
    branch: s.branch,
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${s.pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GitHub PUT ${path} failed: ${res.status} ${await res.text()}`);
  }
}
