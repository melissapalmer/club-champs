import type { Course, DivisionConfig, DayScore, Player } from '../types';

export function courseHandicap(
  hi: number,
  slope: number,
  cr: number,
  par: number,
  maxHc: number
): number {
  const raw = (hi * slope) / 113 + (cr - par);
  return Math.min(raw, maxHc);
}

export function playingHandicap(hc: number, handicapPct: number): number {
  return Math.round((hc * handicapPct) / 100);
}

export function visibleDivisions(course: Course): DivisionConfig[] {
  return course.divisions.filter((d) => !d.hidden);
}

export function divisionFor(player: Player, course: Course): DivisionConfig | undefined {
  // Honour an explicit override only if the target division is visible.
  if (player.divisionOverride) {
    const overridden = course.divisions.find((d) => d.code === player.divisionOverride);
    if (overridden && !overridden.hidden) return overridden;
  }
  // Walk visible divisions in HI order; the lowest visible div absorbs anyone
  // below its hiMin (e.g. when Gold is hidden, a HI-1 player rolls into Silver).
  const visible = visibleDivisions(course).slice().sort((a, b) => a.hiMin - b.hiMin);
  for (let i = 0; i < visible.length; i++) {
    const d = visible[i];
    const isLowest = i === 0;
    if (isLowest && player.hi <= d.hiMax) return d;
    if (!isLowest && player.hi >= d.hiMin && player.hi <= d.hiMax) return d;
  }
  return visible[visible.length - 1];
}

export function dayTotals(holes: (number | null)[]): {
  out: number | null;
  in: number | null;
  gross: number | null;
} {
  const front = holes.slice(0, 9);
  const back = holes.slice(9, 18);
  const sum = (xs: (number | null)[]): number | null =>
    xs.every((x) => x != null && Number.isFinite(x))
      ? (xs as number[]).reduce((a, b) => a + b, 0)
      : null;
  const out = sum(front);
  const in_ = sum(back);
  const gross = out != null && in_ != null ? out + in_ : null;
  return { out, in: in_, gross };
}

export function dayNet(gross: number | null, ph: number): number | null {
  return gross == null ? null : gross - ph;
}

export function overallGross(sat: number | null, sun: number | null): number | null {
  return sat != null && sun != null ? sat + sun : null;
}

export function overallNet(satNet: number | null, sunNet: number | null): number | null {
  return satNet != null && sunNet != null ? satNet + sunNet : null;
}

export function eclecticHoles(
  day1: (number | null)[],
  day2: (number | null)[]
): (number | null)[] {
  return day1.map((d1, i) => {
    const d2 = day2[i];
    if (d1 != null && d2 != null) return Math.min(d1, d2);
    return null;
  });
}

export function eclecticGross(
  day1: (number | null)[],
  day2: (number | null)[]
): number | null {
  const merged = eclecticHoles(day1, day2);
  if (merged.some((h) => h == null)) return null;
  return (merged as number[]).reduce((a, b) => a + b, 0);
}

export function eclecticNet(
  gross: number | null,
  ph: number,
  eclecticPct: number
): number | null {
  return gross == null ? null : gross - (ph * eclecticPct) / 100;
}

/** Standard-competition ranking ("1224"): tied entries share rank, next entries skip. */
export function rankWithTies(values: (number | null)[]): (number | null)[] {
  const indexed = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null);
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number | null>(values.length).fill(null);
  for (let pos = 0; pos < indexed.length; pos++) {
    const { v, i } = indexed[pos];
    if (pos > 0 && indexed[pos - 1].v === v) {
      ranks[i] = ranks[indexed[pos - 1].i];
    } else {
      ranks[i] = pos + 1;
    }
  }
  return ranks;
}

export type PlayerLine = {
  player: Player;
  division: DivisionConfig | undefined;
  hc: number | null;
  ph: number | null;
  sat: { gross: number | null; net: number | null; holes: (number | null)[] };
  sun: { gross: number | null; net: number | null; holes: (number | null)[] };
  overall: { gross: number | null; net: number | null };
  eclectic: { holes: (number | null)[]; gross: number | null; net: number | null };
};

const EMPTY_HOLES: (number | null)[] = Array(18).fill(null);

export function buildPlayerLines(
  players: Player[],
  scores: DayScore[],
  course: Course
): PlayerLine[] {
  const scoreByKey = new Map<string, DayScore>();
  for (const s of scores) scoreByKey.set(`${s.saId}:${s.day}`, s);

  return players.map((player) => {
    const division = divisionFor(player, course);
    const tee = division ? course.tees[division.tee] : undefined;
    const hc = tee
      ? courseHandicap(player.hi, tee.slope, tee.cr, tee.par, course.maxHandicap)
      : null;
    const ph = hc != null && division ? playingHandicap(hc, division.handicapPct) : null;

    const day1Holes = scoreByKey.get(`${player.saId}:1`)?.holes ?? EMPTY_HOLES;
    const day2Holes = scoreByKey.get(`${player.saId}:2`)?.holes ?? EMPTY_HOLES;
    const satGross = dayTotals(day1Holes).gross;
    const sunGross = dayTotals(day2Holes).gross;
    const satNet = ph != null ? dayNet(satGross, ph) : null;
    const sunNet = ph != null ? dayNet(sunGross, ph) : null;

    const eclHoles = eclecticHoles(day1Holes, day2Holes);
    const eclGross = eclecticGross(day1Holes, day2Holes);
    const eclNet = ph != null ? eclecticNet(eclGross, ph, course.eclecticHandicapPct) : null;

    return {
      player,
      division,
      hc,
      ph,
      sat: { gross: satGross, net: satNet, holes: day1Holes },
      sun: { gross: sunGross, net: sunNet, holes: day2Holes },
      overall: {
        gross: overallGross(satGross, sunGross),
        net: overallNet(satNet, sunNet),
      },
      eclectic: { holes: eclHoles, gross: eclGross, net: eclNet },
    };
  });
}

export function linesByDivision(lines: PlayerLine[]): Map<string, PlayerLine[]> {
  const map = new Map<string, PlayerLine[]>();
  for (const line of lines) {
    if (!line.division) continue;
    const list = map.get(line.division.code) ?? [];
    list.push(line);
    map.set(line.division.code, list);
  }
  return map;
}
