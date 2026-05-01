export type TeeRatings = { cr: number; slope: number };

export type Tee = {
  par: number;
  women: TeeRatings;
  men: TeeRatings;
};

export type Hole = {
  /** Par for this hole (3, 4 or 5). */
  par: number;
  /** Ladies' stroke index — handicap-stroke ranking, 1 = hardest. */
  siWomen: number;
  /** Mens' stroke index — handicap-stroke ranking, 1 = hardest. */
  siMen: number;
};

export type PrizeCategory =
  | 'satGross'
  | 'satNet'
  | 'sunGross'
  | 'sunNet'
  | 'overallGross'
  | 'overallNet'
  | 'eclectic'
  | 'satStableford'
  | 'sunStableford'
  | 'overallStableford';

export type PrizeAward = {
  category: PrizeCategory;
  /** How many places to award for this prize. */
  topN: number;
};

export type PrizeConfig = {
  /** Ordered list of prizes this division awards, each with its own top‑N. */
  awards?: PrizeAward[];
};

export type DivisionCode = 'A' | 'B' | 'C' | 'D';

export type DivisionFormat = 'medal' | 'stableford';

export type DivisionConfig = {
  code: DivisionCode;
  name: string;
  tee: keyof Course['tees'];
  hiMin: number;
  hiMax: number;
  handicapPct: number;
  hidden?: boolean;
  prizes?: PrizeConfig;
  /**
   * Scoring format for this division. Defaults to 'medal' when absent.
   * Stableford divisions:
   *   - rank by total stableford points (higher is better)
   *   - prize categories swap net→stableford
   *   - excluded from the Eclectic page
   *   - count-out runs on stableford-points-per-hole (highest wins)
   */
  format?: DivisionFormat;
};

export type BrandingColors = {
  navy?: string;
  navyDeep?: string;
  gold?: string;
  goldLight?: string;
  cream?: string;
  ink?: string;
};

export type Branding = {
  /**
   * Logo asset. Either a fully-qualified URL (https://…) or a path that's
   * resolved against the deployed BASE_URL (e.g. "royal-durban-logo.webp"
   * for a file inside the `public/` folder).
   */
  logoUrl?: string;
  colors?: BrandingColors;
};

export type CountOutSegment = 'back-9' | 'back-6' | 'back-3';

export type CountOutStep = {
  segment: CountOutSegment;
  /** Fraction of PH deducted from this segment when ranking by net (e.g. 0.5 for back-9). */
  netHandicapFraction: number;
};

export type CountOutConfig = {
  enabled: boolean;
  /** Ordered list of tie-break steps. Default: back-9 (½ PH), back-6 (⅓), back-3 (⅙). */
  steps: CountOutStep[];
};

/**
 * Per-day ordering rule for the draw.
 *   - 'best-first':  divisions A→D AND best→worst within each division. Net
 *                    effect: A-scratch tees off in the very first group.
 *   - 'worst-first': divisions D→A AND worst→best within each division. Net
 *                    effect: A-scratch tees off in the very last group
 *                    (traditional Day-2 "leader home last" pattern).
 * The toggle deliberately flips both axes together so "best off first" really
 * does put the best player at the front.
 */
export type DrawOrder = 'best-first' | 'worst-first';

export type TeeTimeConfig = {
  /** Master flag. When false, nav item is hidden and /tee-times shows a "not enabled" empty state. */
  enabled: boolean;
  /** Number of players per tee group (2-, 3- or 4-balls). */
  groupSize: 2 | 3 | 4;
  /** Minutes between consecutive groups starting on the first tee. */
  intervalMinutes: number;
  /** First-group start time as "HH:MM" (24h). */
  day1Start: string;
  day2Start: string;
  /** Ordering rule for Day 1 / Day 2. Defaults applied in code. */
  day1Order?: DrawOrder;
  day2Order?: DrawOrder;
};

/** One row of the auto-generated TeeTimes Sheet tab. */
export type TeeTime = {
  day: 1 | 2;
  /** "HH:MM" 24h. */
  time: string;
  saId: string;
  /** Snapshot of fullName(player) at generation time, written for human readability of the Sheet. */
  name: string;
};

export type MatchPlayConfig = {
  /** Master flag. When false, nav item is hidden and /match-play shows a "not enabled" state. */
  enabled: boolean;
  /** Display name for the bracket, e.g. "Bronze Match Play Final". */
  name?: string;
  /** ISO timestamp set when admin clicks Generate. Used to show "last regenerated at…". */
  bracketGeneratedAt?: string;
  /** Optional restriction to one division. Absent ⇒ open to all opted-in players. */
  divisionCode?: DivisionCode;
};

/**
 * One match in the knockout bracket. Matches are pre-generated up front for the
 * full bracket; rounds 2+ start with empty playerASaId/playerBSaId until the
 * previous round resolves and `propagateAll` slots winners in.
 *
 * id format: "round-slot" (e.g. "1-0", "3-1"). Even slot in round R feeds
 * playerA of round R+1 slot floor(s/2); odd slot feeds playerB.
 *
 * Bye encoding: round-1 match where exactly one of playerA/B is set has
 * winnerSaId == that side and result === "bye". The engine auto-resolves byes
 * during generation so they propagate cleanly into round 2.
 */
export type Match = {
  id: string;
  round: number;
  slot: number;
  playerASaId?: string;
  playerBSaId?: string;
  winnerSaId?: string;
  /** Free text — golf match-play conventions: "1 up", "3 and 2", "won on 19th", "bye". */
  result?: string;
};

export type Course = {
  club: string;
  event: string;
  gender: 'women' | 'men';
  maxHandicap: number;
  eclecticHandicapPct: number;
  tees: Record<'yellow' | 'white' | 'blue' | 'red', Tee>;
  divisions: DivisionConfig[];
  /** Per-hole layout (length 18). Used for scorecard symbols (par-relative) and SI display. */
  holes: Hole[];
  /** Optional branding — logo + colour palette. Falls back to Royal Durban defaults. */
  branding?: Branding;
  /** Optional tie-breaker rules. Absent or `enabled:false` ⇒ ties stay shared with no c/o badge. */
  countOut?: CountOutConfig;
  /** Optional tee-time settings. Absent or `enabled:false` ⇒ Tee Times tab hidden. */
  teeTimes?: TeeTimeConfig;
  /** Optional match-play settings. Absent or `enabled:false` ⇒ Match Play tab hidden. */
  matchPlay?: MatchPlayConfig;
};

export type Player = {
  firstName: string;
  lastName: string;
  saId: string;
  hi: number;
  divisionOverride?: DivisionCode;
  /** Per-player opt-in flag for the Match Play knockout bracket. */
  matchPlay?: boolean;
};

export type DayScore = {
  saId: string;
  day: 1 | 2;
  holes: (number | null)[]; // length 18; null = not yet entered
};

export type ScoreSet = DayScore[];
