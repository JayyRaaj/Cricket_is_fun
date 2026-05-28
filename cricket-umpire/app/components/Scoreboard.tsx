'use client';

import { MatchState } from '../lib/types';
import { formatOvers, getCurrentRunRate, getTarget, getRunsNeeded, getMatchResultText } from '../lib/engine';

interface ScoreboardProps {
  state: MatchState;
}

export default function Scoreboard({ state }: ScoreboardProps) {
  const target = getTarget(state);
  const runsNeeded = getRunsNeeded(state);
  const matchResultText = getMatchResultText(state);

  return (
    <div className="w-full rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 p-5 shadow-2xl shadow-black/40">
      {/* 1st innings summary during 2nd innings */}
      {state.currentInnings === 2 && state.firstInnings && (
        <div className="mb-3 text-center bg-slate-800/80 rounded-xl py-2.5 px-4 border border-slate-700/40">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mb-0.5">
            1st Innings — {state.firstInnings.teamName}
          </p>
          <p className="text-lg font-bold text-slate-300 tabular-nums">
            {state.firstInnings.totalRuns}/{state.firstInnings.totalWickets}
            <span className="text-sm text-slate-500 ml-1.5">
              ({formatOvers(state.firstInnings.totalBalls)})
            </span>
          </p>
        </div>
      )}

      {/* Target banner during 2nd innings */}
      {target !== null && !state.isMatchComplete && (
        <div className="mb-3 text-center bg-amber-900/40 border border-amber-600/30 rounded-xl py-2 px-4">
          <p className="text-xs text-amber-400/80 uppercase tracking-widest font-semibold">Target</p>
          <p className="text-2xl font-black text-amber-400 tabular-nums">{target}</p>
          {runsNeeded !== null && runsNeeded > 0 && (
            <p className="text-xs text-amber-300/70 mt-0.5">
              Need <span className="font-bold text-amber-300">{runsNeeded}</span> from{' '}
              <span className="font-bold text-amber-300">{Math.max(0, state.totalOvers * 6 - state.totalBalls)}</span> balls
            </p>
          )}
        </div>
      )}

      {/* Team name */}
      <div className="text-center mb-3">
        <h2 className="text-lg font-semibold tracking-wide text-amber-400 uppercase">
          {state.teamBatting}
        </h2>
        <p className="text-xs text-slate-400 tracking-widest">
          {state.currentInnings === 1 ? '1ST INNINGS' : '2ND INNINGS'} • BATTING
        </p>
      </div>

      {/* Main score */}
      <div className="text-center mb-4">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-7xl font-black text-white tabular-nums tracking-tight">
            {state.totalRuns}
          </span>
          <span className="text-4xl font-bold text-red-400">/</span>
          <span className="text-5xl font-bold text-red-400 tabular-nums">
            {state.totalWickets}
          </span>
        </div>
        <p className="text-2xl font-semibold text-sky-400 mt-1 tabular-nums">
          ({formatOvers(state.totalBalls)}/{state.totalOvers})
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center bg-slate-800/60 rounded-xl py-2 px-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Run Rate</p>
          <p className="text-xl font-bold text-emerald-400 tabular-nums">{getCurrentRunRate(state)}</p>
        </div>
        <div className="text-center bg-slate-800/60 rounded-xl py-2 px-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Extras</p>
          <p className="text-xl font-bold text-orange-400 tabular-nums">{state.totalExtras}</p>
        </div>
        <div className="text-center bg-slate-800/60 rounded-xl py-2 px-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Balls Left</p>
          <p className="text-xl font-bold text-purple-400 tabular-nums">
            {Math.max(0, state.totalOvers * 6 - state.totalBalls)}
          </p>
        </div>
      </div>

      {/* Match result banner */}
      {state.isMatchComplete && matchResultText && (
        <div className="mt-4 text-center bg-emerald-900/60 border border-emerald-500/40 rounded-xl py-4 px-4">
          <p className="text-[10px] text-emerald-400/70 uppercase tracking-widest font-semibold mb-1">
            🏆 Match Result
          </p>
          <p className="text-xl font-black text-emerald-300 uppercase tracking-wide">
            {matchResultText}
          </p>
        </div>
      )}

      {/* Innings complete (1st innings only — shows when all out or overs done) */}
      {state.isInningsComplete && !state.isMatchComplete && (
        <div className="mt-4 text-center bg-red-900/60 border border-red-500/40 rounded-xl py-3 px-4">
          <p className="text-lg font-bold text-red-300 uppercase tracking-wider">
            ⛳ Innings Complete
          </p>
        </div>
      )}
    </div>
  );
}
