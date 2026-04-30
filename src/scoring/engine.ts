import type {
  Course,
  CountOutSegment,
  CountOutStep,
  DivisionConfig,
  DayScore,
  Player,
  Tee,
  TeeRatings,
} from '../types';

/** Pick the cr/slope appropriate for the event gender from a tee. */
export function teeRatings(tee: Tee, gender: Course['gender']): TeeRatings {
  return tee[gender];
}

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
    const ratings = tee ? teeRatings(tee, course.gender) : undefined;
    const hc =
      tee && ratings
        ? courseHandicap(player.hi, ratings.slope, ratings.cr, tee.par, course.maxHandicap)
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

/** Standard fractions (USGA/CONGU): ½ PH off back-9, ⅓ off back-6, ⅙ off back-3. */
export const DEFAULT_COUNT_OUT_STEPS: CountOutStep[] = [
  { segment: 'back-9', netHandicapFraction: 1 / 2 },
  { segment: 'back-6', netHandicapFraction: 1 / 3 },
  { segment: 'back-3', netHandicapFraction: 1 / 6 },
];

const SEGMENT_RANGE: Record<CountOutSegment, [number, number]> = {
  'back-9': [9, 18],
  'back-6': [12, 18],
  'back-3': [15, 18],
};

/**
 * Sum a tail-of-round segment for one player, optionally net-adjusted.
 * `netFraction` null ⇒ gross sum; number ⇒ subtract `fraction * ph` from the sum.
 * Returns null if any hole in the window is unentered (count-out can't decide on partial data)
 * or if `ph` is null while a net fraction was requested.
 */
export function countOutSegmentValue(
  holes: (number | null)[],
  segment: CountOutSegment,
  ph: number | null,
  netFraction: number | null
): number | null {
  const [start, end] = SEGMENT_RANGE[segment];
  const window = holes.slice(start, end);
  if (window.length !== end - start) return null;
  if (window.some((h) => h == null)) return null;
  const gross = (window as number[]).reduce((a, b) => a + b, 0);
  if (netFraction == null) return gross;
  if (ph == null) return null;
  return gross - netFraction * ph;
}

export type RankScope =
  | { kind: 'day'; day: 1 | 2; metric: 'gross' | 'net' }
  | { kind: 'overall'; metric: 'gross' | 'net' }
  | { kind: 'eclectic'; metric: 'gross' | 'net' };

export type RankResult = {
  /** Score-tied players share the same number; null if no primary value. */
  pos: number | null;
  /** True for every player in a multi-player tie group (drives the "T" prefix). */
  tied: boolean;
  /** True on the player count-out picked as the prize winner inside a tie group. */
  brokenByCountOut: boolean;
};

function primaryValue(line: PlayerLine, scope: RankScope): number | null {
  switch (scope.kind) {
    case 'day':
      return scope.day === 1
        ? scope.metric === 'gross'
          ? line.sat.gross
          : line.sat.net
        : scope.metric === 'gross'
          ? line.sun.gross
          : line.sun.net;
    case 'overall':
      return scope.metric === 'gross' ? line.overall.gross : line.overall.net;
    case 'eclectic':
      return scope.metric === 'gross' ? line.eclectic.gross : line.eclectic.net;
  }
}

function holesForCountOut(line: PlayerLine, scope: RankScope): (number | null)[] {
  switch (scope.kind) {
    case 'day':
      return scope.day === 1 ? line.sat.holes : line.sun.holes;
    // Standard practice for 36-hole events: tie-break on the most recent round.
    case 'overall':
      return line.sun.holes;
    case 'eclectic':
      return line.eclectic.holes;
  }
}

/**
 * Rank a list of players for one scope, applying count-out tie-breaking when
 * `course.countOut?.enabled`. Returned array is parallel to `lines`.
 *
 * Position numbers are NOT shifted by count-out: score-tied players keep the
 * same `pos` and `tied: true`. The count-out winner is the only one with
 * `brokenByCountOut: true` inside that group — that's how the UI knows to
 * render a "c/o" badge.
 *
 * If count-out can't break the tie at any step (all candidates equal), no
 * `brokenByCountOut` is set; the group remains a genuine tie.
 */
export function rankWithCountOut(
  lines: PlayerLine[],
  scope: RankScope,
  course: Course
): RankResult[] {
  const values = lines.map((l) => primaryValue(l, scope));
  const indexed = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null);
  indexed.sort((a, b) => a.v - b.v);

  const out: RankResult[] = lines.map(() => ({
    pos: null,
    tied: false,
    brokenByCountOut: false,
  }));

  type Group = { pos: number; indices: number[] };
  const groups: Group[] = [];
  for (let pos = 0; pos < indexed.length; pos++) {
    const { v, i } = indexed[pos];
    const prev = pos > 0 ? indexed[pos - 1].v : null;
    if (prev != null && prev === v) {
      groups[groups.length - 1].indices.push(i);
    } else {
      groups.push({ pos: pos + 1, indices: [i] });
    }
  }

  const co = course.countOut;
  const isNet = scope.metric === 'net';

  for (const g of groups) {
    const tied = g.indices.length > 1;
    for (const idx of g.indices) {
      out[idx].pos = g.pos;
      out[idx].tied = tied;
    }
    if (!tied || !co?.enabled || co.steps.length === 0) continue;

    let candidates = g.indices;
    for (const step of co.steps) {
      const netFraction = isNet ? step.netHandicapFraction : null;
      const segValues = candidates.map((idx) => {
        const line = lines[idx];
        return {
          idx,
          v: countOutSegmentValue(
            holesForCountOut(line, scope),
            step.segment,
            line.ph,
            netFraction
          ),
        };
      });
      // If any candidate's segment is incomplete, we can't fairly decide here —
      // try the next, smaller window which may be fully entered.
      if (segValues.some((sv) => sv.v == null)) continue;
      const min = Math.min(...segValues.map((sv) => sv.v as number));
      const survivors = segValues.filter((sv) => sv.v === min);
      if (survivors.length === 1) {
        out[survivors[0].idx].brokenByCountOut = true;
        break;
      }
      candidates = survivors.map((sv) => sv.idx);
    }
  }

  return out;
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
