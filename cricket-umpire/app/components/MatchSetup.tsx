'use client';

import { useState } from 'react';
import { MatchState, INITIAL_STATE } from '../lib/types';

interface MatchSetupProps {
  onStart: (state: MatchState) => void;
}

export default function MatchSetup({ onStart }: MatchSetupProps) {
  const [teamBatting, setTeamBatting] = useState('Team A');
  const [teamBowling, setTeamBowling] = useState('Team B');
  const [totalOvers, setTotalOvers] = useState(20);

  const handleStart = () => {
    onStart({
      ...INITIAL_STATE,
      teamBatting: teamBatting.trim() || 'Team A',
      teamBowling: teamBowling.trim() || 'Team B',
      totalOvers,
      matchStarted: true,
    });
  };

  const inputClasses = 'w-full px-4 py-4 text-xl bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent';
  const labelClasses = 'block text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏏</div>
          <h1 className="text-3xl font-black text-white tracking-tight">Cricket Umpire</h1>
          <p className="text-slate-500 mt-1 text-sm">Professional Match Scoring</p>
        </div>

        {/* Form */}
        <div className="space-y-5 bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6">
          <div>
            <label className={labelClasses}>Batting Team</label>
            <input
              type="text"
              value={teamBatting}
              onChange={(e) => setTeamBatting(e.target.value)}
              placeholder="Team A"
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Bowling Team</label>
            <input
              type="text"
              value={teamBowling}
              onChange={(e) => setTeamBowling(e.target.value)}
              placeholder="Team B"
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Total Overs</label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map((ov) => (
                <button
                  key={ov}
                  onClick={() => setTotalOvers(ov)}
                  className={`py-4 text-xl font-bold rounded-xl transition-all duration-150 active:scale-95 ${
                    totalOvers === ov
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/40'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
                  }`}
                >
                  {ov}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={totalOvers}
              onChange={(e) => setTotalOvers(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={100}
              className={`${inputClasses} mt-3 text-center`}
            />
          </div>

          <button
            onClick={handleStart}
            className="w-full py-5 text-2xl font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-2xl transition-all duration-150 active:scale-[0.98] shadow-xl shadow-amber-900/30 mt-4 select-none touch-manipulation"
          >
            Start Match 🏏
          </button>
        </div>

        <p className="text-center text-xs text-slate-600">
          Match state is saved in the URL — bookmark or share anytime
        </p>
      </div>
    </div>
  );
}
