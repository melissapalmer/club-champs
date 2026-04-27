export type Tee = { par: number; cr: number; slope: number };

export type Hole = {
  /** Par for this hole (3, 4 or 5). */
  par: number;
  /** Stroke index — handicap-stroke ranking, 1 = hardest hole through 18 = easiest. */
  si: number;
};

export type PrizeCategory =
  | 'satGross'
  | 'satNet'
  | 'sunGross'
  | 'sunNet'
  | 'overallGross'
  | 'overallNet'
  | 'eclectic';

export type PrizeConfig = {
  /** How many places to award per category. Defaults to 2 if missing. */
  topN?: number;
  /** Which categories this division awards. Defaults to all if missing. */
  categories?: PrizeCategory[];
};

export type DivisionConfig = {
  code: 'A' | 'B' | 'C';
  name: string;
  tee: keyof Course['tees'];
  hiMin: number;
  hiMax: number;
  handicapPct: number;
  hidden?: boolean;
  prizes?: PrizeConfig;
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
};

export type Player = {
  firstName: string;
  lastName: string;
  saId: string;
  hi: number;
  divisionOverride?: 'A' | 'B' | 'C';
};

export type DayScore = {
  saId: string;
  day: 1 | 2;
  holes: (number | null)[]; // length 18; null = not yet entered
};

export type ScoreSet = DayScore[];
