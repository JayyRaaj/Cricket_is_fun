'use client';

import { MatchState } from '../lib/types';
import {
  formatOvers,
  getCurrentRunRate,
  getProjectedScore,
  getRunsNeeded,
  getMatchResultText,
  getRequiredRunRate,
  getActiveBatters,
  getActiveBowlers,
  getStrikeRate,
  getEconomy,
} from '../lib/engine';

interface ScoreboardProps {
  state: MatchState;
}

export default function Scoreboard({ state }: ScoreboardProps) {
  const target = state.currentInnings === 2 && state.firstInnings ? state.firstInnings.totalRuns + 1 : null;
  const runsNeeded = getRunsNeeded(state);
  const matchResultText = getMatchResultText(state);

  // Active batter stats
  const activeBatters = getActiveBatters(state);
  const striker = activeBatters.find((b) => b.name === state.strikerName);
  const nonStriker = activeBatters.find((b) => b.name === state.nonStrikerName);

  // Active bowler stats
  const activeBowlers = getActiveBowlers(state);
  const bowler = activeBowlers.find((b) => b.name === state.currentBowlerName);

  const matchHeader = state.currentInnings === 1
    ? `${state.teamBatting} vs ${state.teamBowling}`
    : `${state.teamBowling} vs ${state.teamBatting}`;

  return (
    <div className="w-full rounded-3xl bg-slate-900 border border-slate-800/80 backdrop-blur-xl p-5 shadow-2xl shadow-black/60 space-y-4">
      
      {/* 1. Header: Team A vs Team B */}
      <div className="flex justify-between items-center border-b border-slate-800/60 pb-2.5">
        <div>
          <h2 className="text-xs font-black tracking-widest text-slate-500 uppercase">
            🏏 {matchHeader}
          </h2>
          <span className="text-[10px] font-bold text-amber-500/90 tracking-wide uppercase">
            {state.currentInnings === 1 ? '1st Innings' : '2nd Innings'} • {state.teamBatting} Batting
          </span>
        </div>
        {target !== null && !state.isMatchComplete && (
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              TARGET
            </span>
            <span className="text-sm font-black text-amber-500 font-mono">
              {target}
            </span>
          </div>
        )}
      </div>

      {/* 2. Big Score Card */}
      <div className="flex items-center justify-between py-1 bg-slate-950/40 rounded-2xl px-4 border border-slate-850">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black text-white tabular-nums tracking-tight">
            {state.totalRuns}
          </span>
          <span className="text-2xl font-bold text-red-500/80">/</span>
          <span className="text-3xl font-black text-red-500/90 tabular-nums">
            {state.totalWickets}
          </span>
          <span className="text-sm text-slate-500 ml-1.5 font-bold tabular-nums">
            ({formatOvers(state.totalBalls)}/{state.totalOvers} Ov)
          </span>
        </div>

        {/* 1st Innings score badge (for context in 2nd innings) */}
        {state.currentInnings === 2 && state.firstInnings && (
          <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700/50 rounded-lg px-2 py-1">
            {state.firstInnings.teamName}: {state.firstInnings.totalRuns}/{state.firstInnings.totalWickets}
          </span>
        )}
      </div>

      {/* 3. Batters Card */}
      <div className="grid grid-cols-2 gap-3 bg-slate-950/20 border border-slate-900 rounded-2xl p-3">
        {/* Striker */}
        {striker ? (
          <div className="bg-slate-950/40 rounded-xl p-2 border border-amber-500/10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1">
                <span className="text-amber-500 text-xs animate-pulse">★</span>
                <span className="text-xs font-bold text-white max-w-[80px] truncate block" title={striker.name}>
                  {striker.name}
                </span>
              </div>
              <span className="text-[9px] text-slate-500 uppercase font-medium tracking-wider">Striker</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-white font-mono tabular-nums">{striker.runs}</span>
              <span className="text-[10px] text-slate-500 font-mono ml-0.5">({striker.balls})</span>
            </div>
          </div>
        ) : (
          <div className="text-slate-600 text-center py-2 text-[10px]">No Striker</div>
        )}

        {/* Non-Striker */}
        {nonStriker ? (
          <div className="bg-slate-950/40 rounded-xl p-2 border border-slate-850 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-slate-300 max-w-[85px] truncate block" title={nonStriker.name}>
                  {nonStriker.name}
                </span>
              </div>
              <span className="text-[9px] text-slate-500 uppercase font-medium tracking-wider">Non-Striker</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-slate-300 font-mono tabular-nums">{nonStriker.runs}</span>
              <span className="text-[10px] text-slate-500 font-mono ml-0.5">({nonStriker.balls})</span>
            </div>
          </div>
        ) : (
          <div className="text-slate-600 text-center py-2 text-[10px]">No Non-Striker</div>
        )}
      </div>

      {/* 4. Active Bowler Stats */}
      {bowler ? (
        <div className="bg-slate-950/20 border border-slate-900 rounded-2xl p-3 flex items-center justify-between text-xs">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sky-500">⚾</span>
              <span className="font-bold text-slate-300 truncate max-w-[120px] block" title={bowler.name}>
                {bowler.name}
              </span>
            </div>
            <span className="text-[9px] text-slate-500 uppercase font-medium tracking-wider">Active Bowler</span>
          </div>
          <div className="text-right font-mono flex items-center gap-2">
            <div>
              <span className="font-bold text-slate-200">{formatOvers(bowler.balls)}</span>
              <span className="text-[10px] text-slate-600 mx-0.5">-</span>
              <span className="font-semibold text-slate-400">{bowler.maidens}</span>
              <span className="text-[10px] text-slate-600 mx-0.5">-</span>
              <span className="font-semibold text-slate-400">{bowler.runsConceded}</span>
              <span className="text-[10px] text-slate-600 mx-0.5">-</span>
              <span className="font-black text-red-400">{bowler.wickets}</span>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono border border-slate-700/50">
              Eco: {getEconomy(bowler.runsConceded, bowler.balls)}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-slate-600 text-center py-2 text-[10px]">No active bowler</div>
      )}

      {/* 5. Run Rates Row */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/40">
        {/* Left Side: CRR / RRR */}
        <div className="bg-slate-950/30 rounded-xl p-2.5 border border-slate-850 flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              Run Rate (CRR)
            </span>
            <span className="font-black text-emerald-400 font-mono">
              {getCurrentRunRate(state)}
            </span>
          </div>
          {state.currentInnings === 2 && runsNeeded !== null && (
            <div className="flex items-center justify-between text-xs mt-1 border-t border-slate-900 pt-1">
              <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wide">
                Req Rate (RRR)
              </span>
              <span className="font-black text-amber-400 font-mono">
                {getRequiredRunRate(state)}
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Projected / Runs Needed */}
        <div className="bg-slate-950/30 rounded-xl p-2.5 border border-slate-850 flex flex-col justify-center">
          {state.currentInnings === 2 && runsNeeded !== null && !state.isMatchComplete ? (
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                NEED TO WIN
              </span>
              <span className="text-sm font-black text-amber-400 font-mono">
                {runsNeeded} runs
              </span>
              <span className="text-[9px] text-slate-500 font-semibold block font-mono">
                off {Math.max(0, state.totalOvers * 6 - state.totalBalls)} balls
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                Projected Score
              </span>
              <span className="font-black text-sky-400 font-mono">
                {getProjectedScore(state)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 6. Match Result Banner */}
      {state.isMatchComplete && matchResultText && (
        <div className="mt-2 text-center bg-emerald-950/70 border border-emerald-500/40 rounded-2xl py-3 px-4 shadow-lg animate-[fade-in_0.2s_ease-out]">
          <p className="text-[10px] text-emerald-400/90 uppercase tracking-widest font-black mb-0.5">
            🏆 Match Finished
          </p>
          <p className="text-lg font-black text-emerald-300 uppercase tracking-wide">
            {matchResultText}
          </p>
        </div>
      )}
    </div>
  );
}
