export const num = (v: number | null | undefined, decimals = 0): string =>
  v == null ? '—' : decimals === 0 ? String(Math.round(v)) : v.toFixed(decimals);

export const fullName = (p: { firstName: string; lastName: string }): string =>
  `${p.firstName} ${p.lastName}`;
