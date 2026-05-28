'use client';

import { useState } from 'react';
import { MatchState, INITIAL_STATE } from '../lib/types';
import {
  addDot, addRuns, addWicket, addWide, addNoBall,
  addBye, addLegBye, undoLastDelivery, endInnings, canEndInnings,
} from '../lib/engine';

interface ScoringControlsProps {
  state: MatchState;
  onStateChange: (newState: MatchState) => void;
}

export default function ScoringControls({ state, onStateChange }: ScoringControlsProps) {
  const [showExtras, setShowExtras] = useState(false);
  const disabled = state.isInningsComplete || state.isMatchComplete;
  const showEndInnings = canEndInnings(state);

  const btnBase = 'font-bold rounded-2xl transition-all duration-150 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed select-none touch-manipulation';

  return (
    <div className="w-full space-y-4">
      {/* Match complete message — hide scoring buttons */}
      {state.isMatchComplete && (
        <div className="text-center py-4">
          <p className="text-slate-400 text-base mb-4">Match is over. Start a new match to score again.</p>
        </div>
      )}

      {/* Primary scoring - Runs */}
      {!state.isMatchComplete && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <button
              disabled={disabled}
              onClick={() => onStateChange(addDot(state))}
              className={`${btnBase} h-20 text-2xl bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600`}
            >
              ·
              <span className="block text-[10px] text-slate-400 font-normal mt-0.5">DOT</span>
            </button>
            <button
              disabled={disabled}
              onClick={() => onStateChange(addRuns(state, 1))}
              className={`${btnBase} h-20 text-3xl bg-slate-700 hover:bg-slate-600 text-white border border-slate-600`}
            >
              1
            </button>
            <button
              disabled={disabled}
              onClick={() => onStateChange(addRuns(state, 2))}
              className={`${btnBase} h-20 text-3xl bg-slate-700 hover:bg-slate-600 text-white border border-slate-600`}
            >
              2
            </button>
            <button
              disabled={disabled}
              onClick={() => onStateChange(addRuns(state, 3))}
              className={`${btnBase} h-20 text-3xl bg-slate-700 hover:bg-slate-600 text-white border border-slate-600`}
            >
              3
            </button>
          </div>

          {/* Boundaries & Wicket */}
          <div className="grid grid-cols-3 gap-3">
            <button
              disabled={disabled}
              onClick={() => onStateChange(addRuns(state, 4))}
              className={`${btnBase} h-20 text-3xl bg-sky-600 hover:bg-sky-500 text-white border border-sky-500 shadow-lg shadow-sky-900/30`}
            >
              4
              <span className="block text-[10px] font-normal mt-0.5 opacity-80">FOUR</span>
            </button>
            <button
              disabled={disabled}
              onClick={() => onStateChange(addRuns(state, 6))}
              className={`${btnBase} h-20 text-3xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 shadow-lg shadow-emerald-900/30`}
            >
              6
              <span className="block text-[10px] font-normal mt-0.5 opacity-80">SIX</span>
            </button>
            <button
              disabled={disabled}
              onClick={() => onStateChange(addWicket(state))}
              className={`${btnBase} h-20 text-2xl bg-red-700 hover:bg-red-600 text-white border border-red-500 shadow-lg shadow-red-900/40`}
            >
              W
              <span className="block text-[10px] font-normal mt-0.5 opacity-80">WICKET</span>
            </button>
          </div>

          {/* Extras toggle */}
          <button
            onClick={() => setShowExtras(!showExtras)}
            className={`w-full ${btnBase} h-12 text-base ${showExtras ? 'bg-amber-600 text-black' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}
          >
            {showExtras ? '▲ Hide Extras' : '▼ Extras (Wide, No Ball, Bye, Leg Bye)'}
          </button>

          {/* Extras panel */}
          {showExtras && (
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={disabled}
                onClick={() => onStateChange(addWide(state, 0))}
                className={`${btnBase} h-16 text-lg bg-yellow-600 hover:bg-yellow-500 text-black border border-yellow-500`}
              >
                Wide
              </button>
              <button
                disabled={disabled}
                onClick={() => onStateChange(addWide(state, 1))}
                className={`${btnBase} h-16 text-lg bg-yellow-700 hover:bg-yellow-600 text-black border border-yellow-600`}
              >
                Wide +1
              </button>
              <button
                disabled={disabled}
                onClick={() => onStateChange(addNoBall(state, 0))}
                className={`${btnBase} h-16 text-lg bg-orange-600 hover:bg-orange-500 text-black border border-orange-500`}
              >
                No Ball
              </button>
              <button
                disabled={disabled}
                onClick={() => onStateChange(addNoBall(state, 1))}
                className={`${btnBase} h-16 text-lg bg-orange-700 hover:bg-orange-600 text-black border border-orange-600`}
              >
                No Ball +1
              </button>
              <button
                disabled={disabled}
                onClick={() => onStateChange(addBye(state, 1))}
                className={`${btnBase} h-16 text-lg bg-purple-700 hover:bg-purple-600 text-white border border-purple-600`}
              >
                Bye 1
              </button>
              <button
                disabled={disabled}
                onClick={() => onStateChange(addBye(state, 2))}
                className={`${btnBase} h-16 text-lg bg-purple-700 hover:bg-purple-600 text-white border border-purple-600`}
              >
                Bye 2
              </button>
              <button
                disabled={disabled}
                onClick={() => onStateChange(addLegBye(state, 1))}
                className={`${btnBase} h-16 text-lg bg-violet-700 hover:bg-violet-600 text-white border border-violet-600`}
              >
                Leg Bye 1
              </button>
              <button
                disabled={disabled}
                onClick={() => onStateChange(addLegBye(state, 2))}
                className={`${btnBase} h-16 text-lg bg-violet-700 hover:bg-violet-600 text-white border border-violet-600`}
              >
                Leg Bye 2
              </button>
            </div>
          )}

          {/* End Innings button — 1st innings only */}
          {showEndInnings && (
            <button
              onClick={() => {
                if (window.confirm(
                  `End ${state.teamBatting}'s innings at ${state.totalRuns}/${state.totalWickets}? ` +
                  `${state.teamBowling} will bat next with a target of ${state.totalRuns + 1}.`
                )) {
                  onStateChange(endInnings(state));
                }
              }}
              className={`w-full ${btnBase} h-16 text-lg bg-gradient-to-r from-cyan-700 to-teal-700 hover:from-cyan-600 hover:to-teal-600 text-white border border-cyan-600 shadow-lg shadow-cyan-900/30`}
            >
              🔄 End Innings
              <span className="block text-[10px] font-normal mt-0.5 opacity-80">
                Switch to {state.teamBowling}&apos;s batting
              </span>
            </button>
          )}
        </>
      )}

      {/* Undo & New Match — always visible */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={() => onStateChange(undoLastDelivery(state))}
          disabled={state.deliveries.length === 0}
          className={`${btnBase} h-14 text-base bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700`}
        >
          ↩ Undo
        </button>
        <button
          onClick={() => {
            if (window.confirm('Start a new match? This will reset all scoring data.')) {
              onStateChange({ ...INITIAL_STATE, matchStarted: false });
            }
          }}
          className={`${btnBase} h-14 text-base bg-slate-800 hover:bg-slate-700 text-red-400 border border-slate-700`}
        >
          ⟳ New Match
        </button>
      </div>
    </div>
  );
}
