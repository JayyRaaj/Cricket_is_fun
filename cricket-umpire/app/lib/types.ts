// Delivery types
export type DeliveryType = 'dot' | 'run' | 'wicket' | 'wide' | 'noball' | 'bye' | 'legbye';

export interface Delivery {
  overNumber: number;    // 0-indexed over
  ballInOver: number;    // 1-6 (legal ball number in the over)
  runs: number;          // runs scored off the bat
  extras: number;        // extra runs (wides, no-balls give 1 extra + runs)
  isWicket: boolean;
  wicketType?: string;   // 'Bowled', 'Caught', 'LBW', 'Stumped', 'Run Out', 'Retired', etc.
  dismissedBatter?: string; // name of batter dismissed
  isWide: boolean;
  isNoBall: boolean;
  isBye: boolean;
  isLegBye: boolean;
  isDot: boolean;        // true if total runs from this delivery = 0
  totalRuns: number;     // runs + extras for this delivery
  label: string;         // display label for the delivery log e.g. '4', 'W', 'wd', 'nb', '·'
  bowlerName: string;    // bowler who bowled this ball
  strikerName: string;   // batter who faced this ball
}

export interface BatterStats {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal: string;     // 'Not Out', 'Bowled', 'Caught', 'LBW', 'Stumped', 'Run Out', 'Retired', etc.
}

export interface BowlerStats {
  name: string;
  balls: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
}

// Summary of a completed innings
export interface InningsSummary {
  teamName: string;
  totalRuns: number;
  totalWickets: number;
  totalBalls: number;
  totalExtras: number;
  deliveries: Delivery[];
  batters: BatterStats[];
  bowlers: BowlerStats[];
}

// Match result after both innings
export type MatchResult =
  | { type: 'none' }                                              // match in progress
  | { type: 'win'; winner: string; margin: number; by: 'runs' | 'wickets' }
  | { type: 'tie' }
  | { type: 'draw' };                                             // unused in limited overs, but included for completeness

export interface MatchState {
  // Match config
  totalOvers: number;       // e.g. 20, 50
  teamBatting: string;
  teamBowling: string;
  
  // Current score
  totalRuns: number;
  totalWickets: number;
  totalBalls: number;        // legal balls bowled
  totalExtras: number;
  
  // Extras breakdown
  wideRuns: number;
  noBallRuns: number;
  byeRuns: number;
  legByeRuns: number;
  
  // Over tracking
  currentOver: number;       // 0-indexed
  ballsInCurrentOver: number; // legal balls in current over (0-5, resets at 6)
  
  // Delivery history
  deliveries: Delivery[];
  
  // Innings state
  isInningsComplete: boolean;
  
  // Match started
  matchStarted: boolean;

  // --- Multi-innings support ---
  currentInnings: 1 | 2;                  // which innings is currently active
  firstInnings: InningsSummary | null;     // saved after 1st innings ends
  matchResult: MatchResult;               // result after 2nd innings
  isMatchComplete: boolean;               // true when match is fully over

  // --- Player Tracking ---
  teamABatters: BatterStats[];
  teamABowlers: BowlerStats[];
  teamBBatters: BatterStats[];
  teamBBowlers: BowlerStats[];

  strikerName: string;      // Current batter facing the ball
  nonStrikerName: string;   // Current batter at bowler's end
  currentBowlerName: string; // Current bowler
}

export const INITIAL_STATE: MatchState = {
  totalOvers: 20,
  teamBatting: 'Team A',
  teamBowling: 'Team B',
  totalRuns: 0,
  totalWickets: 0,
  totalBalls: 0,
  totalExtras: 0,
  wideRuns: 0,
  noBallRuns: 0,
  byeRuns: 0,
  legByeRuns: 0,
  currentOver: 0,
  ballsInCurrentOver: 0,
  deliveries: [],
  isInningsComplete: false,
  matchStarted: false,
  currentInnings: 1,
  firstInnings: null,
  matchResult: { type: 'none' },
  isMatchComplete: false,
  teamABatters: [],
  teamABowlers: [],
  teamBBatters: [],
  teamBBowlers: [],
  strikerName: '',
  nonStrikerName: '',
  currentBowlerName: '',
};
