'use client';

import { useState } from 'react';
import { MatchState, BatterStats, BowlerStats } from '../lib/types';
import {
  addDot,
  addRuns,
  addWicket,
  addWide,
  addNoBall,
  addBye,
  addLegBye,
  undoLastDelivery,
  swapStrike,
  retireBatter,
  getActiveBatters,
  getActiveBowlers,
  canEndInnings,
  endInnings,
  formatOvers,
} from '../lib/engine';

interface ScoringControlsProps {
  state: MatchState;
  onStateChange: (newState: MatchState) => void;
  readOnly?: boolean;
}

export default function ScoringControls({
  state,
  onStateChange,
  readOnly = false,
}: ScoringControlsProps) {
  const disabled = state.isInningsComplete || state.isMatchComplete || readOnly;
  const showEndInnings = canEndInnings(state) && !readOnly;

  // Inline forms state
  const [isEnteringWicket, setIsEnteringWicket] = useState(false);
  const [wicketType, setWicketType] = useState('Bowled');
  const [dismissedBatter, setDismissedBatter] = useState(state.strikerName);

  const [isEnteringRetire, setIsEnteringRetire] = useState(false);
  const [retireTarget, setRetireTarget] = useState(state.strikerName);

  const [nextBatterName, setNextBatterName] = useState('');

  // Get eligible next batters (Not Out, and not currently on strike or non-striker)
  const battersList = getActiveBatters(state);
  const nextBatters = battersList.filter(
    (b) =>
      b.dismissal === 'Not Out' &&
      b.name !== state.strikerName &&
      b.name !== state.nonStrikerName
  );

  const bowlersList = getActiveBowlers(state);

  const circleBtnBase =
    'w-14 h-14 rounded-full flex flex-col items-center justify-center font-black text-base shadow-md transition-all active:scale-[0.9] disabled:opacity-30 disabled:cursor-not-allowed select-none touch-manipulation cursor-pointer';
  const controlBtnBase =
    'flex-1 py-3 text-sm font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-2xl transition-all active:scale-[0.96] disabled:opacity-30 disabled:cursor-not-allowed select-none touch-manipulation cursor-pointer';

  // Handle bowler selection from dropdown
  const handleBowlerChange = (bowlerName: string) => {
    onStateChange({
      ...state,
      currentBowlerName: bowlerName,
    });
  };

  // Submit Wicket Form
  const handleSubmitWicket = () => {
    const nextBatter = nextBatterName || nextBatters[0]?.name || '';
    onStateChange(addWicket(state, wicketType, dismissedBatter, nextBatter));
    
    // Reset form state
    setIsEnteringWicket(false);
    setWicketType('Bowled');
    setNextBatterName('');
  };

  // Submit Retire Form
  const handleSubmitRetire = () => {
    const nextBatter = nextBatterName || nextBatters[0]?.name || '';
    onStateChange(retireBatter(state, retireTarget, nextBatter));
    
    // Reset form state
    setIsEnteringRetire(false);
    setNextBatterName('');
  };

  // Triggers
  const triggerWicketForm = () => {
    setDismissedBatter(state.strikerName);
    setNextBatterName(nextBatters[0]?.name || '');
    setIsEnteringWicket(true);
    setIsEnteringRetire(false);
  };

  const triggerRetireForm = () => {
    setRetireTarget(state.strikerName);
    setNextBatterName(nextBatters[0]?.name || '');
    setIsEnteringRetire(true);
    setIsEnteringWicket(false);
  };

  return (
    <div className="w-full space-y-4">
      {/* 1. Read-only Warning banner */}
      {readOnly && !state.isMatchComplete && (
        <div className="text-center py-3 px-4 bg-amber-950/20 border border-amber-800/40 rounded-2xl">
          <p className="text-amber-400 text-xs font-bold">👁 Read-Only Spectator Mode</p>
          <p className="text-slate-400 text-[10px] mt-0.5">
            You are viewing a live feed. Only the active editor can record runs.
          </p>
        </div>
      )}

      {/* 2. Bowler Switcher & Scorer options (Editor only) */}
      {!disabled && (
        <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider">
            <span>👤 Bowler:</span>
          </div>
          <select
            value={state.currentBowlerName}
            onChange={(e) => handleBowlerChange(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {bowlersList.map((bowler, idx) => (
              <option key={idx} value={bowler.name}>
                {bowler.name} ({formatOvers(bowler.balls)} Ov)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3. Scoring Circle Buttons Panel (Editor only) */}
      {!state.isMatchComplete && !readOnly && !isEnteringWicket && !isEnteringRetire && (
        <div className="bg-slate-950/30 border border-slate-900 rounded-3xl p-5 space-y-5">
          {/* Row 1: Dot, 1, 2, 3 (Dark Grey) */}
          <div className="flex justify-between items-center px-2">
            <button
              disabled={disabled}
              onClick={() => onStateChange(addDot(state))}
              className={`${circleBtnBase} bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200`}
              title="Dot ball"
            >
              <span>·</span>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">dot</span>
            </button>

            {[1, 2, 3].map((run) => (
              <button
                key={run}
                disabled={disabled}
                onClick={() => onStateChange(addRuns(state, run))}
                className={`${circleBtnBase} bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200`}
              >
                {run}
              </button>
            ))}
          </div>

          {/* Row 2: 4, 6 (Green), WD, NB (Gold) */}
          <div className="flex justify-between items-center px-2">
            {[4, 6].map((boundary) => (
              <button
                key={boundary}
                disabled={disabled}
                onClick={() => onStateChange(addRuns(state, boundary))}
                className={`${circleBtnBase} bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/60 text-white`}
              >
                <span>{boundary}</span>
                <span className="text-[7px] font-bold opacity-80 uppercase tracking-widest mt-0.5">
                  {boundary === 4 ? 'four' : 'six'}
                </span>
              </button>
            ))}

            <button
              disabled={disabled}
              onClick={() => onStateChange(addWide(state, 0))}
              className={`${circleBtnBase} bg-amber-500 hover:bg-amber-400 border border-amber-400/60 text-black`}
            >
              <span>WD</span>
              <span className="text-[7px] font-bold opacity-85 uppercase tracking-widest mt-0.5">wide</span>
            </button>

            <button
              disabled={disabled}
              onClick={() => onStateChange(addNoBall(state, 0))}
              className={`${circleBtnBase} bg-amber-500 hover:bg-amber-400 border border-amber-400/60 text-black`}
            >
              <span>NB</span>
              <span className="text-[7px] font-bold opacity-85 uppercase tracking-widest mt-0.5">no ball</span>
            </button>
          </div>

          {/* Row 3: WKT (Red), Bye, Leg Bye (Gold) */}
          <div className="flex justify-start gap-6 items-center px-2">
            <button
              disabled={disabled}
              onClick={triggerWicketForm}
              className={`${circleBtnBase} bg-red-600 hover:bg-red-500 border border-red-500/60 text-white shadow-red-900/20`}
            >
              <span>WKT</span>
              <span className="text-[7px] font-bold opacity-90 uppercase tracking-widest mt-0.5">out</span>
            </button>

            <button
              disabled={disabled}
              onClick={() => onStateChange(addBye(state, 1))}
              className={`${circleBtnBase} bg-yellow-600 hover:bg-yellow-500 border border-yellow-500/50 text-white`}
            >
              <span>B</span>
              <span className="text-[7px] font-bold opacity-80 uppercase tracking-widest mt-0.5">bye</span>
            </button>

            <button
              disabled={disabled}
              onClick={() => onStateChange(addLegBye(state, 1))}
              className={`${circleBtnBase} bg-yellow-600 hover:bg-yellow-500 border border-yellow-500/50 text-white`}
            >
              <span>LB</span>
              <span className="text-[7px] font-bold opacity-80 uppercase tracking-widest mt-0.5">lbye</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Dynamic Wicket Recording Form */}
      {isEnteringWicket && (
        <div className="bg-slate-900 border border-red-900/30 rounded-3xl p-5 space-y-4 animate-[slide-down_0.2s_ease-out]">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
              🔴 Record Wicket
            </h3>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Match ID: {state.totalOvers}O
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">
                Dismissal
              </label>
              <select
                value={wicketType}
                onChange={(e) => setWicketType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
              >
                {['Bowled', 'Caught', 'LBW', 'Stumped', 'Run Out', 'Retired', 'Hit Wicket'].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">
                Who is Out?
              </label>
              <select
                value={dismissedBatter}
                onChange={(e) => setDismissedBatter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
              >
                <option value={state.strikerName}>{state.strikerName} (Striker)</option>
                <option value={state.nonStrikerName}>{state.nonStrikerName} (Non-Striker)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">
              Next Batter
            </label>
            {nextBatters.length > 0 ? (
              <select
                value={nextBatterName}
                onChange={(e) => setNextBatterName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
              >
                {nextBatters.map((b, idx) => (
                  <option key={idx} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-slate-500 text-xs italic pl-1">All out (No batters remaining)</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmitWicket}
              className="flex-1 py-3 text-sm font-bold bg-red-600 hover:bg-red-500 text-white rounded-2xl transition-all cursor-pointer"
            >
              Confirm Wicket 🔴
            </button>
            <button
              onClick={() => setIsEnteringWicket(false)}
              className="px-6 py-3 text-sm font-bold bg-slate-850 hover:bg-slate-800 text-slate-400 rounded-2xl transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 5. Dynamic Retire Batter Form */}
      {isEnteringRetire && (
        <div className="bg-slate-900 border border-amber-900/30 rounded-3xl p-5 space-y-4 animate-[slide-down_0.2s_ease-out]">
          <div>
            <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
              🛡 Retire Batter
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">
                Retire Target
              </label>
              <select
                value={retireTarget}
                onChange={(e) => setRetireTarget(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
              >
                <option value={state.strikerName}>{state.strikerName} (Striker)</option>
                <option value={state.nonStrikerName}>{state.nonStrikerName} (Non-Striker)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">
                Next Batter
              </label>
              {nextBatters.length > 0 ? (
                <select
                  value={nextBatterName}
                  onChange={(e) => setNextBatterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                >
                  {nextBatters.map((b, idx) => (
                    <option key={idx} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-slate-500 text-xs italic pl-1">No batters remaining</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmitRetire}
              className="flex-1 py-3 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-2xl transition-all cursor-pointer"
            >
              Confirm Retirement 🛡
            </button>
            <button
              onClick={() => setIsEnteringRetire(false)}
              className="px-6 py-3 text-sm font-bold bg-slate-850 hover:bg-slate-800 text-slate-400 rounded-2xl transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 6. Scoring Action Buttons (Undo, Swap Strike, Retire) - Editor only */}
      {!readOnly && (
        <div className="flex justify-between gap-3 pt-2">
          <button
            onClick={() => onStateChange(undoLastDelivery(state))}
            disabled={state.deliveries.length === 0 || isEnteringWicket || isEnteringRetire}
            className={`${controlBtnBase} text-amber-400`}
          >
            ↩ Undo
          </button>
          
          <button
            onClick={() => onStateChange(swapStrike(state))}
            disabled={isEnteringWicket || isEnteringRetire}
            className={`${controlBtnBase} text-indigo-400`}
          >
            🔄 Swap Strike
          </button>
          
          <button
            onClick={triggerRetireForm}
            disabled={isEnteringWicket || isEnteringRetire}
            className={`${controlBtnBase} text-red-400`}
          >
            🛡 Retire
          </button>
        </div>
      )}

      {/* 7. End Innings Button Banner (First Innings Editor Only) */}
      {showEndInnings && (
        <button
          onClick={() => {
            if (
              window.confirm(
                `End ${state.teamBatting}'s innings at ${state.totalRuns}/${state.totalWickets}? ` +
                  `${state.teamBowling} will bat next with a target of ${state.totalRuns + 1}.`
              )
            ) {
              onStateChange(endInnings(state));
            }
          }}
          className="w-full py-4 text-sm font-black bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white border border-cyan-500 shadow-lg shadow-cyan-900/30 rounded-2xl transition-all active:scale-[0.98] select-none touch-manipulation cursor-pointer"
        >
          🔄 End Innings & Swaps Ends
          <span className="block text-[9px] font-semibold opacity-75 mt-0.5 uppercase tracking-widest">
            Switch to {state.teamBowling} batting next
          </span>
        </button>
      )}
    </div>
  );
}
