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

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
      }}
    >
      {/* Theme Toggle — top right */}
      <button
        className="nav-btn"
        onClick={toggleTheme}
        title={`Switch to ${
          theme === 'dark' ? 'Light' : theme === 'light' ? 'Sunlight' : 'Dark'
        } Mode`}
        style={{ position: 'absolute', top: 16, right: 16 }}
      >
        {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '☀️'}
      </button>

      <div
        style={{
          width: '100%',
          maxWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.5px',
              lineHeight: 1.2,
            }}
          >
            Cricket Umpire
          </h1>
          <p
            style={{
              fontSize: 15,
              color: 'var(--text-secondary)',
              marginTop: 4,
            }}
          >
            Match Setup
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Batting Team */}
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
              Batting Team
            </label>
            <input
              className="input-field"
              type="text"
              value={teamBatting}
              onChange={(e) => setTeamBatting(e.target.value)}
              placeholder="Team A"
            />
          </div>

          {/* Bowling Team */}
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
              Bowling Team
            </label>
            <input
              className="input-field"
              type="text"
              value={teamBowling}
              onChange={(e) => setTeamBowling(e.target.value)}
              placeholder="Team B"
            />
          </div>

          {/* Overs Selector */}
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
              Total Overs
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
              }}
            >
              {[5, 10, 20, 50].map((ov) => (
                <button
                  key={ov}
                  onClick={() => setTotalOvers(ov)}
                  style={{
                    height: 44,
                    borderRadius: 'var(--radius-button)',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border:
                      totalOvers === ov
                        ? 'none'
                        : '1px solid color-mix(in srgb, var(--text-secondary) 25%, transparent)',
                    background:
                      totalOvers === ov ? 'var(--accent)' : 'var(--surface)',
                    color: totalOvers === ov ? '#FFFFFF' : 'var(--text)',
                    transition: 'all 0.15s ease',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                  }}
                >
                  {ov}
                </button>
              ))}
            </div>
            <input
              className="input-field"
              type="number"
              value={totalOvers}
              onChange={(e) =>
                setTotalOvers(Math.max(1, parseInt(e.target.value) || 1))
              }
              min={1}
              max={100}
              style={{ marginTop: 10, textAlign: 'center', fontWeight: 600 }}
            />
          </div>

          {/* Player Setup Accordion */}
          <div
            style={{
              borderTop: '0.5px solid color-mix(in srgb, var(--text-secondary) 20%, transparent)',
              paddingTop: 16,
            }}
          >
            <button
              onClick={() => setShowPlayerSetup(!showPlayerSetup)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              <span className="label-caps">Player Names (Optional)</span>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  transition: 'transform 0.2s ease',
                  transform: showPlayerSetup ? 'rotate(180deg)' : 'rotate(0deg)',
                  display: 'inline-block',
                }}
              >
                ▼
              </span>
            </button>

            {showPlayerSetup && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 12 }}>
                <div>
                  <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
                    {teamBatting} Players (11 names, comma or line separated)
                  </label>
                  <textarea
                    className="input-field"
                    rows={4}
                    value={teamAPlayersInput}
                    onChange={(e) => setTeamAPlayersInput(e.target.value)}
                    placeholder="E.g. Sachin, Virat, Rohit, Dhoni..."
                    style={{ fontFamily: 'monospace', fontSize: 14, lineHeight: 1.6, resize: 'none' }}
                  />
                </div>

                <div>
                  <label className="label-caps" style={{ display: 'block', marginBottom: 6 }}>
                    {teamBowling} Players (11 names, comma or line separated)
                  </label>
                  <textarea
                    className="input-field"
                    rows={4}
                    value={teamBPlayersInput}
                    onChange={(e) => setTeamBPlayersInput(e.target.value)}
                    placeholder="E.g. Warne, McGrath, Ponting, Gilchrist..."
                    style={{ fontFamily: 'monospace', fontSize: 14, lineHeight: 1.6, resize: 'none' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Start Match Button */}
          <button
            className="btn-primary"
            onClick={handleStart}
            style={{ marginTop: 8 }}
          >
            Start Match
          </button>
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--text-secondary)',
            opacity: 0.4,
          }}
        >
          Powered by Google DeepMind Antigravity
        </p>
      </div>
    </div>
  );
}
