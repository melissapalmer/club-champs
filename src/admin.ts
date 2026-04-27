import { useEffect, useState } from 'react';

// Cosmetic gate — the repo is public, so this string lives in the bundle.
// Real write protection comes from the GitHub PAT, which lives only in
// the organiser's localStorage.
export const ACCESS_KEY = 'durban2026';
const KEY_STORAGE = 'rd-cc-access';
const ADMIN_CHANGE_EVENT = 'rd-admin-change';

export function isAdmin(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(KEY_STORAGE) === ACCESS_KEY;
}

export function setAdmin(value: boolean): void {
  if (value) sessionStorage.setItem(KEY_STORAGE, ACCESS_KEY);
  else sessionStorage.removeItem(KEY_STORAGE);
  window.dispatchEvent(new Event(ADMIN_CHANGE_EVENT));
}

export function useIsAdmin(): boolean {
  const [admin, setAdminState] = useState(() => isAdmin());
  useEffect(() => {
    const onChange = () => setAdminState(isAdmin());
    window.addEventListener(ADMIN_CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(ADMIN_CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return admin;
}
