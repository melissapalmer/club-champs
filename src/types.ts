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
  | 'eclectic';

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

export type DivisionConfig = {
  code: DivisionCode;
  name: string;
  tee: keyof Course['tees'];
  hiMin: number;
  hiMax: number;
  handicapPct: number;
  hidden?: boolean;
  prizes?: PrizeConfig;
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
