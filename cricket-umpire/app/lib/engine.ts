import { MatchState, Delivery, InningsSummary, MatchResult } from './types';

function createLabel(delivery: Partial<Delivery>): string {
  if (delivery.isWicket) return 'W';
  if (delivery.isWide) return delivery.extras && delivery.extras > 1 ? `wd+${delivery.extras - 1}` : 'wd';
  if (delivery.isNoBall) {
    const batRuns = delivery.runs || 0;
    return batRuns > 0 ? `nb+${batRuns}` : 'nb';
  }
  if (delivery.isBye) return `b${delivery.runs || 0}`;
  if (delivery.isLegBye) return `lb${delivery.runs || 0}`;
  if (delivery.runs === 0) return '·'; // dot ball — use middle dot character
  return String(delivery.runs);
}

function checkInningsComplete(state: MatchState): boolean {
  // All overs bowled
  if (state.totalBalls >= state.totalOvers * 6) return true;
  // All out (10 wickets)
  if (state.totalWickets >= 10) return true;
  // 2nd innings: chasing team surpassed target
  if (state.currentInnings === 2 && state.firstInnings) {
    if (state.totalRuns > state.firstInnings.totalRuns) return true;
  }
  return false;
}

/**
 * After 2nd innings completes, determine the match result.
 */
function determineMatchResult(state: MatchState): MatchResult {
  if (state.currentInnings !== 2 || !state.firstInnings) {
    return { type: 'none' };
  }

  const target = state.firstInnings.totalRuns + 1;
  const chasingRuns = state.totalRuns;
  const chasingWickets = state.totalWickets;

  if (chasingRuns >= target) {
    // Chasing team won
    return {
      type: 'win',
      winner: state.teamBatting,
      margin: 10 - chasingWickets,
      by: 'wickets',
    };
  } else if (chasingRuns === state.firstInnings.totalRuns) {
    // Tied
    return { type: 'tie' };
  } else {
    // First innings team won
    return {
      type: 'win',
      winner: state.teamBowling,
      margin: state.firstInnings.totalRuns - chasingRuns,
      by: 'runs',
    };
  }
}

/**
 * Check if we should auto-complete the match after a state change
 * (only relevant during 2nd innings).
 */
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

export function addDot(state: MatchState): MatchState {
  if (state.isInningsComplete) return state;
  const newBallsInOver = state.ballsInCurrentOver + 1;
  const overComplete = newBallsInOver >= 6;
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver + 1,
    runs: 0, extras: 0, isWicket: false, isWide: false, isNoBall: false,
    isBye: false, isLegBye: false, isDot: true, totalRuns: 0, label: '·',
  };
  const newState: MatchState = {
    ...state,
    totalBalls: state.totalBalls + 1,
    ballsInCurrentOver: overComplete ? 0 : newBallsInOver,
    currentOver: overComplete ? state.currentOver + 1 : state.currentOver,
    deliveries: [...state.deliveries, delivery],
  };
  newState.isInningsComplete = checkInningsComplete(newState);
  return checkAndFinalizeMatch(newState);
}

export function addRuns(state: MatchState, runs: number): MatchState {
  if (state.isInningsComplete) return state;
  const newBallsInOver = state.ballsInCurrentOver + 1;
  const overComplete = newBallsInOver >= 6;
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver + 1,
    runs, extras: 0, isWicket: false, isWide: false, isNoBall: false,
    isBye: false, isLegBye: false, isDot: false, totalRuns: runs, label: String(runs),
  };
  const newState: MatchState = {
    ...state,
    totalRuns: state.totalRuns + runs,
    totalBalls: state.totalBalls + 1,
    ballsInCurrentOver: overComplete ? 0 : newBallsInOver,
    currentOver: overComplete ? state.currentOver + 1 : state.currentOver,
    deliveries: [...state.deliveries, delivery],
  };
  newState.isInningsComplete = checkInningsComplete(newState);
  return checkAndFinalizeMatch(newState);
}

export function addWicket(state: MatchState): MatchState {
  if (state.isInningsComplete) return state;
  const newBallsInOver = state.ballsInCurrentOver + 1;
  const overComplete = newBallsInOver >= 6;
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver + 1,
    runs: 0, extras: 0, isWicket: true, isWide: false, isNoBall: false,
    isBye: false, isLegBye: false, isDot: false, totalRuns: 0, label: 'W',
  };
  const newState: MatchState = {
    ...state,
    totalWickets: state.totalWickets + 1,
    totalBalls: state.totalBalls + 1,
    ballsInCurrentOver: overComplete ? 0 : newBallsInOver,
    currentOver: overComplete ? state.currentOver + 1 : state.currentOver,
    deliveries: [...state.deliveries, delivery],
  };
  newState.isInningsComplete = checkInningsComplete(newState);
  return checkAndFinalizeMatch(newState);
}

export function addWide(state: MatchState, additionalRuns: number = 0): MatchState {
  if (state.isInningsComplete) return state;
  // Wide does NOT count as a legal ball
  const extrasTotal = 1 + additionalRuns;
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver, // doesn't increment
    runs: 0, extras: extrasTotal, isWicket: false, isWide: true, isNoBall: false,
    isBye: false, isLegBye: false, isDot: false, totalRuns: extrasTotal,
    label: additionalRuns > 0 ? `wd+${additionalRuns}` : 'wd',
  };
  const newState: MatchState = {
    ...state,
    totalRuns: state.totalRuns + extrasTotal,
    totalExtras: state.totalExtras + extrasTotal,
    // NO increment to totalBalls or ballsInCurrentOver
    deliveries: [...state.deliveries, delivery],
  };
  // Wides can cause the chasing team to win in 2nd innings
  newState.isInningsComplete = checkInningsComplete(newState);
  return checkAndFinalizeMatch(newState);
}

export function addNoBall(state: MatchState, batsmanRuns: number = 0): MatchState {
  if (state.isInningsComplete) return state;
  // No-ball does NOT count as a legal ball. 1 extra + batsman runs.
  const extrasTotal = 1;
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver,
    runs: batsmanRuns, extras: extrasTotal, isWicket: false, isWide: false, isNoBall: true,
    isBye: false, isLegBye: false, isDot: false, totalRuns: batsmanRuns + extrasTotal,
    label: batsmanRuns > 0 ? `nb+${batsmanRuns}` : 'nb',
  };
  const newState: MatchState = {
    ...state,
    totalRuns: state.totalRuns + batsmanRuns + extrasTotal,
    totalExtras: state.totalExtras + extrasTotal,
    deliveries: [...state.deliveries, delivery],
  };
  newState.isInningsComplete = checkInningsComplete(newState);
  return checkAndFinalizeMatch(newState);
}

export function addBye(state: MatchState, runs: number): MatchState {
  if (state.isInningsComplete) return state;
  const newBallsInOver = state.ballsInCurrentOver + 1;
  const overComplete = newBallsInOver >= 6;
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver + 1,
    runs: 0, extras: runs, isWicket: false, isWide: false, isNoBall: false,
    isBye: true, isLegBye: false, isDot: false, totalRuns: runs,
    label: `b${runs}`,
  };
  const newState: MatchState = {
    ...state,
    totalRuns: state.totalRuns + runs,
    totalExtras: state.totalExtras + runs,
    totalBalls: state.totalBalls + 1,
    ballsInCurrentOver: overComplete ? 0 : newBallsInOver,
    currentOver: overComplete ? state.currentOver + 1 : state.currentOver,
    deliveries: [...state.deliveries, delivery],
  };
  newState.isInningsComplete = checkInningsComplete(newState);
  return checkAndFinalizeMatch(newState);
}

export function addLegBye(state: MatchState, runs: number): MatchState {
  if (state.isInningsComplete) return state;
  const newBallsInOver = state.ballsInCurrentOver + 1;
  const overComplete = newBallsInOver >= 6;
  const delivery: Delivery = {
    overNumber: state.currentOver,
    ballInOver: state.ballsInCurrentOver + 1,
    runs: 0, extras: runs, isWicket: false, isWide: false, isNoBall: false,
    isBye: false, isLegBye: true, isDot: false, totalRuns: runs,
    label: `lb${runs}`,
  };
  const newState: MatchState = {
    ...state,
    totalRuns: state.totalRuns + runs,
    totalExtras: state.totalExtras + runs,
    totalBalls: state.totalBalls + 1,
    ballsInCurrentOver: overComplete ? 0 : newBallsInOver,
    currentOver: overComplete ? state.currentOver + 1 : state.currentOver,
    deliveries: [...state.deliveries, delivery],
  };
  newState.isInningsComplete = checkInningsComplete(newState);
  return checkAndFinalizeMatch(newState);
}

export function undoLastDelivery(state: MatchState): MatchState {
  if (state.deliveries.length === 0) return state;
  const lastDelivery = state.deliveries[state.deliveries.length - 1];
  const newDeliveries = state.deliveries.slice(0, -1);
  
  const isLegalBall = !lastDelivery.isWide && !lastDelivery.isNoBall;
  
  const newState: MatchState = {
    ...state,
    totalRuns: state.totalRuns - lastDelivery.totalRuns,
    totalWickets: state.totalWickets - (lastDelivery.isWicket ? 1 : 0),
    totalBalls: isLegalBall ? state.totalBalls - 1 : state.totalBalls,
    totalExtras: state.totalExtras - lastDelivery.extras,
    deliveries: newDeliveries,
    isInningsComplete: false,
    isMatchComplete: false,
    matchResult: state.currentInnings === 2 ? { type: 'none' } : state.matchResult,
  };
  
  // Recalculate current over and balls in over from total legal balls
  newState.currentOver = Math.floor(newState.totalBalls / 6);
  newState.ballsInCurrentOver = newState.totalBalls % 6;
  
  return newState;
}

/**
 * End the current innings and switch to the second innings.
 * Saves first innings data and swaps batting/bowling teams.
 */
export function endInnings(state: MatchState): MatchState {
  // Can only end the first innings
  if (state.currentInnings !== 1) return state;
  // Need at least 1 legal ball bowled
  if (state.totalBalls === 0) return state;

  const firstInnings: InningsSummary = {
    teamName: state.teamBatting,
    totalRuns: state.totalRuns,
    totalWickets: state.totalWickets,
    totalBalls: state.totalBalls,
    totalExtras: state.totalExtras,
    deliveries: state.deliveries,
  };

  return {
    ...state,
    // Swap teams
    teamBatting: state.teamBowling,
    teamBowling: state.teamBatting,
    // Reset scoring state for 2nd innings
    totalRuns: 0,
    totalWickets: 0,
    totalBalls: 0,
    totalExtras: 0,
    currentOver: 0,
    ballsInCurrentOver: 0,
    deliveries: [],
    isInningsComplete: false,
    // Switch to 2nd innings
    currentInnings: 2,
    firstInnings: firstInnings,
    matchResult: { type: 'none' },
    isMatchComplete: false,
  };
}

/**
 * Check if the "End Innings" button should be shown.
 * Visible when: 1st innings, at least 1 over bowled OR all out, and innings not yet ended.
 */
export function canEndInnings(state: MatchState): boolean {
  if (state.currentInnings !== 1) return false;
  if (state.isMatchComplete) return false;
  // At least 1 legal ball bowled
  if (state.totalBalls < 1) return false;
  return true;
}

/**
 * Get the target score for the 2nd innings team.
 */
export function getTarget(state: MatchState): number | null {
  if (state.currentInnings !== 2 || !state.firstInnings) return null;
  return state.firstInnings.totalRuns + 1;
}

/**
 * Get remaining runs needed to win in 2nd innings.
 */
export function getRunsNeeded(state: MatchState): number | null {
  const target = getTarget(state);
  if (target === null) return null;
  return Math.max(0, target - state.totalRuns);
}

/**
 * Format the match result as a human-readable string.
 */
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

export function getCurrentRunRate(state: MatchState): string {
  if (state.totalBalls === 0) return '0.00';
  const overs = state.totalBalls / 6;
  return (state.totalRuns / overs).toFixed(2);
}
