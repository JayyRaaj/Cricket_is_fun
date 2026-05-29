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
    <div className="sheet-overlay">
      {/* Backdrop */}
      <div className="sheet-backdrop" onClick={onClose} />

      {/* Sheet Content */}
      <div className="sheet-content">
        {/* Drag Handle */}
        <div className="sheet-handle" />

        {/* Header */}
        <div className="sheet-header">
          <h2>Scorecard</h2>
          <button className="sheet-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="sheet-tabs">
          <button
            className={`sheet-tab${activeTab === 'first' ? ' active' : ''}`}
            onClick={() => setActiveTab('first')}
          >
            {firstInningsBatTeam}
          </button>
          <button
            className={`sheet-tab${activeTab === 'second' ? ' active' : ''}`}
            onClick={() => setActiveTab('second')}
          >
            {secondInningsBatTeam}
          </button>
        </div>

        {/* Body */}
        <div className="sheet-body">
          {!hasInningsStarted ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 16px',
            }}>
              <p style={{
                fontSize: 15,
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}>
                Innings has not started yet
              </p>
            </div>
          ) : (
            <>
              {/* Summary Banner */}
              <div style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-card)',
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                    marginBottom: 4,
                  }}>
                    {teamName}
                  </div>
                  <div style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--text)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {inningsScore}
                  </div>
                </div>
                <span style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  background: 'var(--bg)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {inningsOvers} ov
                </span>
              </div>

              {/* Batting Section */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  padding: '0 8px 8px',
                }}>
                  Batting
                </div>
                <table className="scorecard-table">
                  <thead>
                    <tr>
                      <th>Batter</th>
                      <th className="right">R</th>
                      <th className="right">B</th>
                      <th className="right">4s</th>
                      <th className="right">6s</th>
                      <th className="right">SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {battingList.map((player, idx) => {
                      const isActive =
                        player.dismissal === 'Not Out' &&
                        (state.strikerName === player.name || state.nonStrikerName === player.name);
                      return (
                        <tr
                          key={idx}
                          className={isActive ? 'active-player' : ''}
                        >
                          <td>
                            <div style={{ fontWeight: 600 }}>
                              {player.name}
                              {player.dismissal === 'Not Out' && state.strikerName === player.name && ' *'}
                            </div>
                            <div style={{
                              fontSize: 11,
                              color: 'var(--text-secondary)',
                              fontWeight: 400,
                              marginTop: 1,
                            }}>
                              {player.dismissal}
                            </div>
                          </td>
                          <td className="right bold">{player.runs}</td>
                          <td className="right muted">{player.balls}</td>
                          <td className="right muted">{player.fours}</td>
                          <td className="right muted">{player.sixes}</td>
                          <td className="right muted">{getStrikeRate(player.runs, player.balls)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Extras */}
              <div style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                padding: '8px',
                marginBottom: 16,
              }}>
                Extras: <span style={{ fontWeight: 600, color: 'var(--text)' }}>{extrasInfo.total}</span>{' '}
                (wd {extrasInfo.wd}, nb {extrasInfo.nb}, b {extrasInfo.b}, lb {extrasInfo.lb})
              </div>

              {/* Bowling Section */}
              {bowlingList.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                    padding: '0 8px 8px',
                  }}>
                    Bowling
                  </div>
                  <table className="scorecard-table">
                    <thead>
                      <tr>
                        <th>Bowler</th>
                        <th className="right">O</th>
                        <th className="right">M</th>
                        <th className="right">R</th>
                        <th className="right">W</th>
                        <th className="right">Eco</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bowlingList.map((player, idx) => {
                        const isActive = state.currentBowlerName === player.name;
                        return (
                          <tr
                            key={idx}
                            className={isActive ? 'active-player' : ''}
                          >
                            <td style={{ fontWeight: 600 }}>{player.name}</td>
                            <td className="right muted">{formatOvers(player.balls)}</td>
                            <td className="right muted">{player.maidens}</td>
                            <td className="right">{player.runsConceded}</td>
                            <td className="right bold">{player.wickets}</td>
                            <td className="right muted">{getEconomy(player.runsConceded, player.balls)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
