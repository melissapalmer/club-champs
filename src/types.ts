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
};

export type Player = {
  firstName: string;
  lastName: string;
  saId: string;
  hi: number;
  divisionOverride?: DivisionCode;
};

export type DayScore = {
  saId: string;
  day: 1 | 2;
  holes: (number | null)[]; // length 18; null = not yet entered
};

export type ScoreSet = DayScore[];
