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

  const ballsRemaining = Math.max(0, state.totalOvers * 6 - state.totalBalls);

  return (
    <div
      style={{
        width: '100%',
        padding: '32px 24px',
      }}
    >
      {/* Header: innings label */}
      <div
        className="label-caps"
        style={{
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {matchHeader} • {state.currentInnings === 1 ? '1st Innings' : '2nd Innings'}
      </div>

      {/* Massive score */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <span className="score-massive">{state.totalRuns}</span>
        <span className="score-wickets">/{state.totalWickets}</span>
      </div>

      {/* Overs */}
      <div
        className="overs-text"
        style={{
          textAlign: 'center',
          marginTop: 8,
        }}
      >
        {formatOvers(state.totalBalls)} ov
      </div>

      {/* 2nd innings: target + need */}
      {state.currentInnings === 2 && target !== null && !state.isMatchComplete && (
        <div
          style={{
            textAlign: 'center',
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-secondary)',
            }}
          >
            Target: {target}
          </span>
          {runsNeeded !== null && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--orange)',
              }}
            >
              Need {runsNeeded} off {ballsRemaining} balls
            </span>
          )}
        </div>
      )}

      {/* Striker info */}
      <div
        style={{
          textAlign: 'center',
          marginTop: 24,
        }}
      >
        {striker ? (
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span style={{ color: 'var(--orange)', marginRight: 4 }}>★</span>
            {striker.name}
            <span
              style={{
                marginLeft: 8,
                fontWeight: 600,
              }}
            >
              {striker.runs}
            </span>
            <span
              style={{
                color: 'var(--text-secondary)',
                fontWeight: 400,
              }}
            >
              ({striker.balls})
            </span>
          </div>
        ) : (
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
          >
            No striker
          </div>
        )}
      </div>

      {/* Non-Striker — smaller, secondary line */}
      {nonStriker && (
        <div
          style={{
            textAlign: 'center',
            marginTop: 4,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {nonStriker.name}
          <span style={{ marginLeft: 8, fontWeight: 500 }}>
            {nonStriker.runs}
          </span>
          <span>({nonStriker.balls})</span>
        </div>
      )}

      {/* Bowler info */}
      <div
        style={{
          textAlign: 'center',
          marginTop: 8,
        }}
      >
        {bowler ? (
          <div
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span style={{ marginRight: 4 }}>⚾</span>
            {bowler.name}
            <span style={{ marginLeft: 8 }}>
              {formatOvers(bowler.balls)}-{bowler.maidens}-{bowler.runsConceded}-{bowler.wickets}
            </span>
          </div>
        ) : (
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
          >
            No active bowler
          </div>
        )}
      </div>

      {/* Match Result Banner */}
      {state.isMatchComplete && matchResultText && (
        <div className="match-result" style={{ marginTop: 24 }}>
          <p className="result-label">Match Complete</p>
          <p className="result-text">{matchResultText}</p>
        </div>
      )}
    </div>
  );
}
