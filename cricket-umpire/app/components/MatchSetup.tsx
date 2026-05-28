'use client';

import { useState, useEffect } from 'react';
import { MatchState, INITIAL_STATE, BatterStats, BowlerStats } from '../lib/types';

interface MatchSetupProps {
  onStart: (state: MatchState) => void;
}

export default function MatchSetup({ onStart }: MatchSetupProps) {
  const [teamBatting, setTeamBatting] = useState('Team A');
  const [teamBowling, setTeamBowling] = useState('Team B');
  const [totalOvers, setTotalOvers] = useState(20);
  const [showPlayerSetup, setShowPlayerSetup] = useState(false);

  // Theme state supporting 'dark', 'light', and 'sunlight' modes
  const [theme, setTheme] = useState<'dark' | 'light' | 'sunlight'>('dark');

  // Hydrate theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('cricket-umpire-theme') as 'dark' | 'light' | 'sunlight' | null;
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'sunlight') {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const defaultTheme = systemDark ? 'dark' : 'light';
      setTheme(defaultTheme);
      applyTheme(defaultTheme);
    }
  }, []);

  const applyTheme = (t: 'dark' | 'light' | 'sunlight') => {
    const html = document.documentElement;
    html.classList.remove('dark', 'light', 'sunlight');
    html.classList.add(t);
    localStorage.setItem('cricket-umpire-theme', t);
  };

  const toggleTheme = () => {
    let nextTheme: 'dark' | 'light' | 'sunlight' = 'dark';
    if (theme === 'dark') nextTheme = 'light';
    else if (theme === 'light') nextTheme = 'sunlight';
    else nextTheme = 'dark';
    
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  // Raw player inputs
  const [teamAPlayersInput, setTeamAPlayersInput] = useState('');
  const [teamBPlayersInput, setTeamBPlayersInput] = useState('');

  const parsePlayerNames = (input: string, teamName: string): string[] => {
    const names = input
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    
    const result = [...names];
    for (let i = result.length; i < 11; i++) {
      result.push(`${teamName} Batter ${i + 1}`);
    }
    return result.slice(0, 11);
  };

  const handleStart = () => {
    const batTeam = teamBatting.trim() || 'Team A';
    const bowlTeam = teamBowling.trim() || 'Team B';

    // Parse players
    const teamAPlayers = parsePlayerNames(teamAPlayersInput, batTeam);
    const teamBPlayers = parsePlayerNames(teamBPlayersInput, bowlTeam);

    // Map to BatterStats and BowlerStats
    const teamABatters: BatterStats[] = teamAPlayers.map((name) => ({
      name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      dismissal: 'Not Out',
    }));

    const teamABowlers: BowlerStats[] = teamAPlayers.map((name) => ({
      name,
      balls: 0,
      runsConceded: 0,
      wickets: 0,
      maidens: 0,
    }));

    const teamBBatters: BatterStats[] = teamBPlayers.map((name) => ({
      name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      dismissal: 'Not Out',
    }));

    const teamBBowlers: BowlerStats[] = teamBPlayers.map((name) => ({
      name,
      balls: 0,
      runsConceded: 0,
      wickets: 0,
      maidens: 0,
    }));

    onStart({
      ...INITIAL_STATE,
      teamBatting: batTeam,
      teamBowling: bowlTeam,
      totalOvers,
      matchStarted: true,
      
      // Player lists
      teamABatters,
      teamABowlers,
      teamBBatters,
      teamBBowlers,

      // Initial active players
      // In Innings 1, Team A is batting (teamABatters) and Team B is bowling (teamBBowlers)
      strikerName: teamABatters[0]?.name || '',
      nonStrikerName: teamABatters[1]?.name || '',
      currentBowlerName: teamBBowlers[0]?.name || '',
    });
  };

  const inputClasses =
    'w-full px-4 py-3.5 text-base bg-slate-850 border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all';
  const labelClasses =
    'block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative">
      {/* Floating Theme Toggle in top-right */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-2xl text-amber-400 font-black shadow-lg transition-all active:scale-95 cursor-pointer text-sm"
          title={`Switch to ${
            theme === 'dark' ? 'Light' : theme === 'light' ? 'Sunlight' : 'Dark'
          } Mode`}
        >
          {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🕶️'}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6 py-6">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-5xl mb-2 animate-bounce">🏏</div>
          <h1 className="text-3xl font-black text-white tracking-tight bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            Cricket Umpire
          </h1>
          <p className="text-slate-400 mt-1 text-sm font-medium">Professional Match Scoring</p>
        </div>

        {/* Main Card */}
        <div className="space-y-5 bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl shadow-black/80">
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
                  className={`py-3 text-sm font-black rounded-xl transition-all duration-150 active:scale-95 ${
                    totalOvers === ov
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/25'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700/80 border border-slate-700/50'
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
              className={`${inputClasses} mt-2.5 text-center font-bold`}
            />
          </div>

          {/* Collapsible Player Config Accordion */}
          <div className="border-t border-slate-800/80 pt-4">
            <button
              onClick={() => setShowPlayerSetup(!showPlayerSetup)}
              className="w-full flex items-center justify-between py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              <span>⚙ {showPlayerSetup ? 'HIDE' : 'SETUP'} PLAYER NAMES (OPTIONAL)</span>
              <span>{showPlayerSetup ? '▲' : '▼'}</span>
            </button>

            {showPlayerSetup && (
              <div className="space-y-4 pt-3 animate-[slide-down_0.2s_ease-out]">
                <div>
                  <label className={labelClasses}>{teamBatting} Players (11 names, comma or line separated)</label>
                  <textarea
                    rows={4}
                    value={teamAPlayersInput}
                    onChange={(e) => setTeamAPlayersInput(e.target.value)}
                    placeholder="E.g. Sachin, Virat, Rohit, Dhoni..."
                    className={`${inputClasses} font-mono text-sm leading-relaxed resize-none`}
                  />
                </div>

                <div>
                  <label className={labelClasses}>{teamBowling} Players (11 names, comma or line separated)</label>
                  <textarea
                    rows={4}
                    value={teamBPlayersInput}
                    onChange={(e) => setTeamBPlayersInput(e.target.value)}
                    placeholder="E.g. Warne, McGrath, Ponting, Gilchrist..."
                    className={`${inputClasses} font-mono text-sm leading-relaxed resize-none`}
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleStart}
            className="w-full py-4 text-xl font-black bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black rounded-2xl transition-all duration-150 active:scale-[0.98] shadow-xl shadow-amber-500/20 mt-4 select-none touch-manipulation cursor-pointer"
          >
            Start Match 🏏
          </button>
        </div>

        <p className="text-center text-xs text-slate-500 font-medium">
          Powered by Google DeepMind Antigravity
        </p>
      </div>
    </div>
  );
}
