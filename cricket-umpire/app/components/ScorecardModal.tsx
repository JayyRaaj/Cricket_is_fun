'use client';

import { useState } from 'react';
import { MatchState, BatterStats, BowlerStats, Delivery } from '../lib/types';
import { getStrikeRate, getEconomy, formatOvers } from '../lib/engine';

interface ScorecardModalProps {
  state: MatchState;
  onClose: () => void;
}

export default function ScorecardModal({ state, onClose }: ScorecardModalProps) {
  // Determine which team bats first vs second
  const firstInningsBatTeam = state.firstInnings ? state.firstInnings.teamName : state.teamBatting;
  const secondInningsBatTeam = state.firstInnings ? state.teamBatting : state.teamBowling;

  const [activeTab, setActiveTab] = useState<'first' | 'second'>('first');

  // Helper to calculate extras breakdown from deliveries
  const getExtrasBreakdown = (deliveries: Delivery[], totalExtras: number) => {
    let wd = 0, nb = 0, b = 0, lb = 0;
    deliveries.forEach((d) => {
      if (d.isWide) wd += d.totalRuns;
      if (d.isNoBall) nb += d.extras;
      if (d.isBye) b += d.extras;
      if (d.isLegBye) lb += d.extras;
    });
    return { total: totalExtras, wd, nb, b, lb };
  };

  // Get scorecard data for the selected tab
  let battingList: BatterStats[] = [];
  let bowlingList: BowlerStats[] = [];
  let extrasInfo = { total: 0, wd: 0, nb: 0, b: 0, lb: 0 };
  let inningsScore = '0/0';
  let inningsOvers = '0.0';
  let hasInningsStarted = false;
  let teamName = '';

  if (activeTab === 'first') {
    teamName = firstInningsBatTeam;
    if (state.currentInnings === 1) {
      // Innings 1 is currently in progress
      battingList = state.teamABatters;
      bowlingList = state.teamBBowlers.filter(b => b.balls > 0 || b.runsConceded > 0);
      extrasInfo = {
        total: state.totalExtras,
        wd: state.wideRuns,
        nb: state.noBallRuns,
        b: state.byeRuns,
        lb: state.legByeRuns,
      };
      inningsScore = `${state.totalRuns}/${state.totalWickets}`;
      inningsOvers = formatOvers(state.totalBalls);
      hasInningsStarted = true;
    } else {
      // Innings 1 is completed (saved in state.firstInnings)
      const first = state.firstInnings;
      if (first) {
        battingList = first.batters;
        bowlingList = first.bowlers.filter(b => b.balls > 0 || b.runsConceded > 0);
        extrasInfo = getExtrasBreakdown(first.deliveries, first.totalExtras);
        inningsScore = `${first.totalRuns}/${first.totalWickets}`;
        inningsOvers = formatOvers(first.totalBalls);
        hasInningsStarted = true;
      }
    }
  } else {
    teamName = secondInningsBatTeam;
    if (state.currentInnings === 2) {
      // Innings 2 is currently in progress
      battingList = state.teamBBatters;
      bowlingList = state.teamABowlers.filter(b => b.balls > 0 || b.runsConceded > 0);
      extrasInfo = {
        total: state.totalExtras,
        wd: state.wideRuns,
        nb: state.noBallRuns,
        b: state.byeRuns,
        lb: state.legByeRuns,
      };
      inningsScore = `${state.totalRuns}/${state.totalWickets}`;
      inningsOvers = formatOvers(state.totalBalls);
      hasInningsStarted = true;
    } else {
      // Innings 2 hasn't started yet
      hasInningsStarted = false;
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="text-lg font-black text-white tracking-tight">
              Match Scorecard
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white text-slate-400 text-sm flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-900 bg-slate-950">
          <button
            onClick={() => setActiveTab('first')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'first'
                ? 'border-amber-500 text-amber-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {firstInningsBatTeam}
          </button>
          <button
            onClick={() => setActiveTab('second')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'second'
                ? 'border-amber-500 text-amber-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {secondInningsBatTeam}
          </button>
        </div>

        {/* Scorecard Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {!hasInningsStarted ? (
            <div className="text-center py-12">
              <p className="text-5xl mb-4 opacity-50">⏳</p>
              <p className="text-slate-400 font-medium">Innings has not started yet</p>
              <p className="text-xs text-slate-600 mt-1">Score the first innings to unlock this scorecard.</p>
            </div>
          ) : (
            <>
              {/* Quick Summary Banner */}
              <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {teamName} Batting
                  </h3>
                  <p className="text-2xl font-black text-white mt-1">
                    {inningsScore}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/50">
                    {inningsOvers} Overs
                  </span>
                </div>
              </div>

              {/* Batting Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
                  Batting
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-slate-900 bg-slate-950">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-900 bg-slate-900/30 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Batter</th>
                        <th className="py-2.5 px-1">How Out</th>
                        <th className="py-2.5 px-2 text-right">R</th>
                        <th className="py-2.5 px-2 text-right">B</th>
                        <th className="py-2.5 px-2 text-right">4s</th>
                        <th className="py-2.5 px-2 text-right">6s</th>
                        <th className="py-2.5 px-3 text-right">SR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/50 font-medium">
                      {battingList.map((player, idx) => (
                        <tr
                          key={idx}
                          className={
                            player.dismissal === 'Not Out' &&
                            (state.strikerName === player.name || state.nonStrikerName === player.name)
                              ? 'text-amber-400 bg-amber-500/5'
                              : 'text-slate-300 hover:bg-slate-900/25'
                          }
                        >
                          <td className="py-2.5 px-3 font-semibold break-words max-w-[100px]">
                            {player.name}
                            {player.dismissal === 'Not Out' && state.strikerName === player.name && ' *'}
                          </td>
                          <td className="py-2.5 px-1 text-slate-500 text-[10px] italic">
                            {player.dismissal}
                          </td>
                          <td className="py-2.5 px-2 text-right font-black">
                            {player.runs}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                            {player.balls}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-400">
                            {player.fours}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-400">
                            {player.sixes}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            {getStrikeRate(player.runs, player.balls)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Extras line */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-3 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider">
                  Extras
                </span>
                <span className="font-mono text-slate-300">
                  <span className="font-black text-white">{extrasInfo.total}</span> (wd {extrasInfo.wd}, nb {extrasInfo.nb}, b {extrasInfo.b}, lb {extrasInfo.lb})
                </span>
              </div>

              {/* Bowling Table */}
              {bowlingList.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
                    Bowling
                  </h4>
                  <div className="overflow-x-auto rounded-2xl border border-slate-900 bg-slate-950">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-900 bg-slate-900/30 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Bowler</th>
                          <th className="py-2.5 px-2 text-right">O</th>
                          <th className="py-2.5 px-2 text-right">M</th>
                          <th className="py-2.5 px-2 text-right">R</th>
                          <th className="py-2.5 px-2 text-right">W</th>
                          <th className="py-2.5 px-3 text-right">Eco</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/50 text-slate-300 font-medium">
                        {bowlingList.map((player, idx) => (
                          <tr
                            key={idx}
                            className={
                              state.currentBowlerName === player.name
                                ? 'text-amber-400 bg-amber-500/5'
                                : 'hover:bg-slate-900/25'
                            }
                          >
                            <td className="py-2.5 px-3 font-semibold break-words max-w-[120px]">
                              {player.name}
                              {state.currentBowlerName === player.name && ' 🏏'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono">
                              {formatOvers(player.balls)}
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              {player.maidens}
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              {player.runsConceded}
                            </td>
                            <td className="py-2.5 px-2 text-right font-black">
                              {player.wickets}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                              {getEconomy(player.runsConceded, player.balls)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
