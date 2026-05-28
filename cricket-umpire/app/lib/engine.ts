import { MatchState, Delivery, InningsSummary, MatchResult, BatterStats, BowlerStats } from './types';

function createLabel(delivery: Partial<Delivery>): string {
  if (delivery.isWicket) return 'W';
  if (delivery.isWide) return delivery.extras && delivery.extras > 1 ? `wd+${delivery.extras - 1}` : 'wd';
  if (delivery.isNoBall) {
    const batRuns = delivery.runs || 0;
    return batRuns > 0 ? `nb+${batRuns}` : 'nb';
  }
  if (delivery.isBye) return `b${delivery.runs || 0}`;
  if (delivery.isLegBye) return `lb${delivery.runs || 0}`;
  if (delivery.runs === 0) return '·';
  return String(delivery.runs);
}

function checkInningsComplete(state: MatchState): boolean {
  if (state.totalBalls >= state.totalOvers * 6) return true;
  if (state.totalWickets >= 10) return true;
  if (state.currentInnings === 2 && state.firstInnings) {
    if (state.totalRuns > state.firstInnings.totalRuns) return true;
  }
  return false;
}

function determineMatchResult(state: MatchState): MatchResult {
  if (state.currentInnings !== 2 || !state.firstInnings) {
    return { type: 'none' };
  }

  const target = state.firstInnings.totalRuns + 1;
  const chasingRuns = state.totalRuns;
  const chasingWickets = state.totalWickets;

  if (chasingRuns >= target) {
    return {
      type: 'win',
      winner: state.teamBatting,
      margin: 10 - chasingWickets,
      by: 'wickets',
    };
  } else if (chasingRuns === state.firstInnings.totalRuns) {
    return { type: 'tie' };
  } else {
    return {
      type: 'win',
      winner: state.teamBowling,
      margin: state.firstInnings.totalRuns - chasingRuns,
      by: 'runs',
    };
  }
}

function checkAndFinalizeMatch(state: MatchState): MatchState {
  if (state.currentInnings === 2 && state.isInningsComplete && !state.isMatchComplete) {
    return {
      ...state,
      matchResult: determineMatchResult(state),
      isMatchComplete: true,
    };
  }
  return state;
}

// Helpers to get/set active batters/bowlers lists based on current innings
export function getActiveBatters(state: MatchState): BatterStats[] {
  return state.currentInnings === 1 ? state.teamABatters : state.teamBBatters;
}

export function setActiveBatters(state: MatchState, batters: BatterStats[]): MatchState {
  if (state.currentInnings === 1) {
    return { ...state, teamABatters: batters };
  } else {
    return { ...state, teamBBatters: batters };
  }
}

export function getActiveBowlers(state: MatchState): BowlerStats[] {
  return state.currentInnings === 1 ? state.teamBBowlers : state.teamABowlers;
}

export function setActiveBowlers(state: MatchState, bowlers: BowlerStats[]): MatchState {
  if (state.currentInnings === 1) {
    return { ...state, teamBBowlers: bowlers };
  } else {
    return { ...state, teamABowlers: bowlers };
  }
}

// Utility to apply statistics changes to striker and bowler
function updatePlayerStats(
  state: MatchState,
  runsBat: number,
  extrasConcededByBowler: number,
  isLegalBall: boolean,
  isNoBall: boolean,
  isWicket: boolean,
  wicketType?: string,
  dismissedBatterName?: string,
  nextBatterName?: string
): MatchState {
  let batters = [...getActiveBatters(state)];
  let bowlers = [...getActiveBowlers(state)];

  const striker = batters.find(b => b.name === state.strikerName);
  const bowler = bowlers.find(b => b.name === state.currentBowlerName);

  // 1. Update striker stats
  if (striker) {
    if (isLegalBall || isNoBall) {
      // Faces a ball on legal deliveries OR on No Balls
      striker.balls += 1;
    }
    striker.runs += runsBat;
    if (runsBat === 4) striker.fours += 1;
    if (runsBat === 6) striker.sixes += 1;

    if (isWicket && dismissedBatterName === striker.name) {
      striker.dismissal = wicketType || 'Bowled';
    }
  }

  // Update non-striker dismissal if they are run out / retired
  if (isWicket && dismissedBatterName === state.nonStrikerName) {
    const nonStriker = batters.find(b => b.name === state.nonStrikerName);
    if (nonStriker) {
      nonStriker.dismissal = wicketType || 'Run Out';
    }
  }

  // 2. Update bowler stats
  if (bowler) {
    if (isLegalBall) {
      bowler.balls += 1;
    }
    bowler.runsConceded += runsBat + extrasConcededByBowler;
    if (isWicket && wicketType !== 'Run Out' && wicketType !== 'Retired') {
      bowler.wickets += 1;
    }
  }

  // 3. Wicket Replacement Handling
  let newStrikerName = state.strikerName;
  let newNonStrikerName = state.nonStrikerName;

  if (isWicket && dismissedBatterName) {
    const isStrikerDismissed = dismissedBatterName === state.strikerName;
    const replacementName = nextBatterName || batters.find(b => b.dismissal === 'Not Out' && b.name !== state.strikerName && b.name !== state.nonStrikerName)?.name || '';

    if (isStrikerDismissed) {
      newStrikerName = replacementName;
    } else {
      newNonStrikerName = replacementName;
    }
  }

  let newState = setActiveBatters(state, batters);
  newState = setActiveBowlers(newState, bowlers);
  newState.strikerName = newStrikerName;
  newState.nonStrikerName = newNonStrikerName;

  return newState;
}

// Check if a completed over was a maiden
function checkAndAddMaiden(state: MatchState, bowlerName: string): MatchState {
  const completedOverNum = state.currentOver - 1;
  const overDeliveries = state.deliveries.filter(d => d.overNumber === completedOverNum);
  
  if (overDeliveries.length === 0) return state;

  // Bowler runs conceded = bat runs + wide/no-ball extras
  const runsConceded = overDeliveries.reduce((sum, d) => {
    const bowlerRuns = d.runs + (d.isWide || d.isNoBall ? d.extras : 0);
    return sum + bowlerRuns;
  }, 0);

  if (runsConceded === 0) {
    const bowlers = [...getActiveBowlers(state)];
    const bowler = bowlers.find(b => b.name === bowlerName);
    if (bowler) {
      bowler.maidens += 1;
      return setActiveBowlers(state, bowlers);
    }
  }
  return state;
}

// End of ball state processor (increments overs, checks for ends of overs and strike swaps)
function processEndofBall(state: MatchState, wasLegal: boolean, runsToSwapStrike: number): MatchState {
  let newState = { ...state };
  
  if (wasLegal) {
    const newBallsInOver = state.ballsInCurrentOver + 1;
    const overComplete = newBallsInOver >= 6;
    
    newState.totalBalls = state.totalBalls + 1;
    newState.ballsInCurrentOver = overComplete ? 0 : newBallsInOver;
    newState.currentOver = overComplete ? state.currentOver + 1 : state.currentOver;
    
    // Swap strike if run count is odd
    if (runsToSwapStrike % 2 !== 0) {
      newState = swapStrike(newState);
    }

    // Swap strike at the end of the over
    if (overComplete) {
      newState = swapStrike(newState);
      newState = checkAndAddMaiden(newState, state.currentBowlerName);
      
      // Auto-assign next bowler (excluding current one)
      const bowlers = getActiveBowlers(newState);
      const nextBowler = bowlers.find(b => b.name !== state.currentBowlerName) || bowlers[0];
      if (nextBowler) {
        newState.currentBowlerName = nextBowler.name;
      }
    }
  } else {
    // Illegal balls don't count for legal balls in over, but can still swap strike on odd run-wides
    if (runsToSwapStrike % 2 !== 0) {
      newState = swapStrike(newState);
    }
  }

  newState.isInningsComplete = checkInningsComplete(newState);
  return checkAndFinalizeMatch(newState);
}

export function swapStrike(state: MatchState): MatchState {
  return {
    ...state,
    strikerName: state.nonStrikerName,
    nonStrikerName: state.strikerName,
  };
}

export function retireBatter(state: MatchState, name: string, nextBatterName?: string): MatchState {
  let batters = [...getActiveBatters(state)];
  const batter = batters.find(b => b.name === name);
  if (!batter) return state;

  batter.dismissal = 'Retired';

  // Find a replacement batter
  const replacementName = nextBatterName || batters.find(b => b.dismissal === 'Not Out' && b.name !== state.strikerName && b.name !== state.nonStrikerName)?.name || '';

  let newState = setActiveBatters(state, batters);
  if (state.strikerName === name) {
    newState.strikerName = replacementName;
  } else {
    newState.nonStrikerName = replacementName;
  }

  return newState;
}

export function addDot(state: MatchState): MatchState {
  if (state.isInningsComplete) return state;
  
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver + 1,
    runs: 0, extras: 0, isWicket: false, isWide: false, isNoBall: false,
    isBye: false, isLegBye: false, isDot: true, totalRuns: 0, label: '·',
    bowlerName: state.currentBowlerName, strikerName: state.strikerName,
  };
  
  let newState = {
    ...state,
    deliveries: [...state.deliveries, delivery],
  };

  newState = updatePlayerStats(newState, 0, 0, true, false, false);
  return processEndofBall(newState, true, 0);
}

export function addRuns(state: MatchState, runs: number): MatchState {
  if (state.isInningsComplete) return state;
  
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver + 1,
    runs, extras: 0, isWicket: false, isWide: false, isNoBall: false,
    isBye: false, isLegBye: false, isDot: false, totalRuns: runs, label: String(runs),
    bowlerName: state.currentBowlerName, strikerName: state.strikerName,
  };

  let newState = {
    ...state,
    totalRuns: state.totalRuns + runs,
    deliveries: [...state.deliveries, delivery],
  };

  newState = updatePlayerStats(newState, runs, 0, true, false, false);
  return processEndofBall(newState, true, runs);
}

export function addWicket(
  state: MatchState,
  wicketType: string = 'Bowled',
  dismissedBatterName?: string,
  nextBatterName?: string
): MatchState {
  if (state.isInningsComplete) return state;
  
  const targetDismissed = dismissedBatterName || state.strikerName;
  
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver + 1,
    runs: 0, extras: 0, isWicket: true, isWide: false, isNoBall: false,
    isBye: false, isLegBye: false, isDot: false, totalRuns: 0, label: 'W',
    wicketType, dismissedBatter: targetDismissed,
    bowlerName: state.currentBowlerName, strikerName: state.strikerName,
  };

  let newState = {
    ...state,
    totalWickets: state.totalWickets + 1,
    deliveries: [...state.deliveries, delivery],
  };

  newState = updatePlayerStats(newState, 0, 0, true, false, true, wicketType, targetDismissed, nextBatterName);
  return processEndofBall(newState, true, 0);
}

export function addWide(state: MatchState, additionalRuns: number = 0): MatchState {
  if (state.isInningsComplete) return state;
  
  const extrasTotal = 1 + additionalRuns;
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver, // does not increment
    runs: 0, extras: extrasTotal, isWicket: false, isWide: true, isNoBall: false,
    isBye: false, isLegBye: false, isDot: false, totalRuns: extrasTotal,
    label: additionalRuns > 0 ? `wd+${additionalRuns}` : 'wd',
    bowlerName: state.currentBowlerName, strikerName: state.strikerName,
  };

  let newState = {
    ...state,
    totalRuns: state.totalRuns + extrasTotal,
    totalExtras: state.totalExtras + extrasTotal,
    wideRuns: state.wideRuns + extrasTotal,
    deliveries: [...state.deliveries, delivery],
  };

  newState = updatePlayerStats(newState, 0, extrasTotal, false, false, false);
  return processEndofBall(newState, false, additionalRuns); // Wides are conceded as extras, striker does not face or run bat runs
}

export function addNoBall(state: MatchState, batsmanRuns: number = 0): MatchState {
  if (state.isInningsComplete) return state;
  
  const extrasTotal = 1;
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver,
    runs: batsmanRuns, extras: extrasTotal, isWicket: false, isWide: false, isNoBall: true,
    isBye: false, isLegBye: false, isDot: false, totalRuns: batsmanRuns + extrasTotal,
    label: batsmanRuns > 0 ? `nb+${batsmanRuns}` : 'nb',
    bowlerName: state.currentBowlerName, strikerName: state.strikerName,
  };

  let newState = {
    ...state,
    totalRuns: state.totalRuns + batsmanRuns + extrasTotal,
    totalExtras: state.totalExtras + extrasTotal,
    noBallRuns: state.noBallRuns + extrasTotal,
    deliveries: [...state.deliveries, delivery],
  };

  newState = updatePlayerStats(newState, batsmanRuns, extrasTotal, false, true, false);
  return processEndofBall(newState, false, batsmanRuns);
}

export function addBye(state: MatchState, runs: number): MatchState {
  if (state.isInningsComplete) return state;
  
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver + 1,
    runs: 0, extras: runs, isWicket: false, isWide: false, isNoBall: false,
    isBye: true, isLegBye: false, isDot: false, totalRuns: runs,
    label: `b${runs}`,
    bowlerName: state.currentBowlerName, strikerName: state.strikerName,
  };

  let newState = {
    ...state,
    totalRuns: state.totalRuns + runs,
    totalExtras: state.totalExtras + runs,
    byeRuns: state.byeRuns + runs,
    deliveries: [...state.deliveries, delivery],
  };

  newState = updatePlayerStats(newState, 0, 0, true, false, false); // Byes do not count as bowler runs conceded
  return processEndofBall(newState, true, runs);
}

export function addLegBye(state: MatchState, runs: number): MatchState {
  if (state.isInningsComplete) return state;
  
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver + 1,
    runs: 0, extras: runs, isWicket: false, isWide: false, isNoBall: false,
    isBye: false, isLegBye: true, isDot: false, totalRuns: runs,
    label: `lb${runs}`,
    bowlerName: state.currentBowlerName, strikerName: state.strikerName,
  };

  let newState = {
    ...state,
    totalRuns: state.totalRuns + runs,
    totalExtras: state.totalExtras + runs,
    legByeRuns: state.legByeRuns + runs,
    deliveries: [...state.deliveries, delivery],
  };

  newState = updatePlayerStats(newState, 0, 0, true, false, false); // Leg byes do not count as bowler runs conceded
  return processEndofBall(newState, true, runs);
}

export function undoLastDelivery(state: MatchState): MatchState {
  if (state.deliveries.length === 0) return state;
  
  const lastDelivery = state.deliveries[state.deliveries.length - 1];
  const newDeliveries = state.deliveries.slice(0, -1);
  
  const isLegalBall = !lastDelivery.isWide && !lastDelivery.isNoBall;
  
  // Revert general state
  let newState: MatchState = {
    ...state,
    totalRuns: state.totalRuns - lastDelivery.totalRuns,
    totalWickets: state.totalWickets - (lastDelivery.isWicket ? 1 : 0),
    totalBalls: isLegalBall ? state.totalBalls - 1 : state.totalBalls,
    totalExtras: state.totalExtras - lastDelivery.extras,
    wideRuns: state.wideRuns - (lastDelivery.isWide ? lastDelivery.extras : 0),
    noBallRuns: state.noBallRuns - (lastDelivery.isNoBall ? lastDelivery.extras : 0),
    byeRuns: state.byeRuns - (lastDelivery.isBye ? lastDelivery.extras : 0),
    legByeRuns: state.legByeRuns - (lastDelivery.isLegBye ? lastDelivery.extras : 0),
    deliveries: newDeliveries,
    isInningsComplete: false,
    isMatchComplete: false,
    matchResult: state.currentInnings === 2 ? { type: 'none' } : state.matchResult,
  };

  // Re-calculate over tracking
  newState.currentOver = Math.floor(newState.totalBalls / 6);
  newState.ballsInCurrentOver = newState.totalBalls % 6;

  // Revert active batter and bowler stats
  let batters = [...getActiveBatters(state)];
  let bowlers = [...getActiveBowlers(state)];
  
  const striker = batters.find(b => b.name === lastDelivery.strikerName);
  const bowler = bowlers.find(b => b.name === lastDelivery.bowlerName);

  if (striker) {
    if (isLegalBall || lastDelivery.isNoBall) {
      striker.balls = Math.max(0, striker.balls - 1);
    }
    striker.runs = Math.max(0, striker.runs - lastDelivery.runs);
    if (lastDelivery.runs === 4) striker.fours = Math.max(0, striker.fours - 1);
    if (lastDelivery.runs === 6) striker.sixes = Math.max(0, striker.sixes - 1);
    
    if (lastDelivery.isWicket && lastDelivery.dismissedBatter === striker.name) {
      striker.dismissal = 'Not Out';
    }
  }

  // Handle non-striker wicket revert
  if (lastDelivery.isWicket && lastDelivery.dismissedBatter === lastDelivery.strikerName === false) {
    const nonStriker = batters.find(b => b.name === lastDelivery.dismissedBatter);
    if (nonStriker) {
      nonStriker.dismissal = 'Not Out';
    }
  }

  if (bowler) {
    if (isLegalBall) {
      bowler.balls = Math.max(0, bowler.balls - 1);
    }
    const bowlerConceded = lastDelivery.runs + (lastDelivery.isWide || lastDelivery.isNoBall ? lastDelivery.extras : 0);
    bowler.runsConceded = Math.max(0, bowler.runsConceded - bowlerConceded);
    if (lastDelivery.isWicket && lastDelivery.wicketType !== 'Run Out' && lastDelivery.wicketType !== 'Retired') {
      bowler.wickets = Math.max(0, bowler.wickets - 1);
    }
  }

  // Restore striker, non-striker and bowler to what they were during this delivery
  newState.strikerName = lastDelivery.strikerName;
  newState.currentBowlerName = lastDelivery.bowlerName;
  // Non-striker is the one of the two active batters who isn't the striker
  const activeB = batters.filter(b => b.dismissal === 'Not Out');
  const foundNonStriker = activeB.find(b => b.name !== lastDelivery.strikerName);
  if (foundNonStriker) {
    newState.nonStrikerName = foundNonStriker.name;
  }

  newState = setActiveBatters(newState, batters);
  newState = setActiveBowlers(newState, bowlers);

  return newState;
}

export function endInnings(state: MatchState): MatchState {
  if (state.currentInnings !== 1) return state;
  if (state.totalBalls === 0) return state;

  const firstInnings: InningsSummary = {
    teamName: state.teamBatting,
    totalRuns: state.totalRuns,
    totalWickets: state.totalWickets,
    totalBalls: state.totalBalls,
    totalExtras: state.totalExtras,
    deliveries: state.deliveries,
    batters: getActiveBatters(state),
    bowlers: getActiveBowlers(state),
  };

  const nextBattingTeamBatters = state.teamBBatters;
  
  return {
    ...state,
    teamBatting: state.teamBowling,
    teamBowling: state.teamBatting,
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
    currentInnings: 2,
    firstInnings: firstInnings,
    matchResult: { type: 'none' },
    isMatchComplete: false,
    
    // Set active players for 2nd innings
    strikerName: nextBattingTeamBatters[0]?.name || '',
    nonStrikerName: nextBattingTeamBatters[1]?.name || '',
    currentBowlerName: state.teamABowlers[0]?.name || '',
  };
}

export function canEndInnings(state: MatchState): boolean {
  if (state.currentInnings !== 1) return false;
  if (state.isMatchComplete) return false;
  if (state.totalBalls < 1) return false;
  return true;
}

export function getTarget(state: MatchState): number | null {
  if (state.currentInnings !== 2 || !state.firstInnings) return null;
  return state.firstInnings.totalRuns + 1;
}

export function getRunsNeeded(state: MatchState): number | null {
  const target = getTarget(state);
  if (target === null) return null;
  return Math.max(0, target - state.totalRuns);
}

export function getMatchResultText(state: MatchState): string | null {
  if (!state.isMatchComplete) return null;
  const result = state.matchResult;
  if (result.type === 'win') {
    return `${result.winner} won by ${result.margin} ${result.by}`;
  }
  if (result.type === 'tie') {
    return 'Match Tied!';
  }
  return null;
}

export function formatOvers(totalBalls: number): string {
  const overs = Math.floor(totalBalls / 6);
  const balls = totalBalls % 6;
  return `${overs}.${balls}`;
}

export function getStrikeRate(runs: number, balls: number): string {
  if (balls === 0) return '0.0';
  return ((runs / balls) * 100).toFixed(1);
}

export function getEconomy(runsConceded: number, ballsBowled: number): string {
  if (ballsBowled === 0) return '0.00';
  return ((runsConceded / ballsBowled) * 6).toFixed(2);
}

export function getCurrentRunRate(state: MatchState): string {
  if (state.totalBalls === 0) return '0.00';
  return ((state.totalRuns / state.totalBalls) * 6).toFixed(2);
}

export function getProjectedScore(state: MatchState): number {
  const crr = parseFloat(getCurrentRunRate(state));
  return Math.round(crr * state.totalOvers);
}

export function getOversRemaining(state: MatchState): number {
  const totalBallsInMatch = state.totalOvers * 6;
  const remainingBalls = Math.max(0, totalBallsInMatch - state.totalBalls);
  return remainingBalls / 6;
}

export function getRequiredRunRate(state: MatchState): string {
  const runsNeeded = getRunsNeeded(state);
  if (runsNeeded === null) return '0.00';
  
  const oversRemaining = getOversRemaining(state);
  if (oversRemaining <= 0) return runsNeeded > 0 ? '∞' : '0.00';
  
  return (runsNeeded / oversRemaining).toFixed(2);
}
