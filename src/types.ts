export type Tee = { par: number; cr: number; slope: number };

export type DivisionConfig = {
  code: 'A' | 'B' | 'C';
  name: string;
  tee: keyof Course['tees'];
  hiMin: number;
  hiMax: number;
  handicapPct: number;
  hidden?: boolean;
};

export type Course = {
  club: string;
  event: string;
  gender: 'women' | 'men';
  maxHandicap: number;
  eclecticHandicapPct: number;
  tees: Record<'yellow' | 'white' | 'blue' | 'red', Tee>;
  divisions: DivisionConfig[];
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
