'use client';

import { useState } from 'react';
import { MatchState } from '../lib/types';
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

  // Wicket form state
  const [isEnteringWicket, setIsEnteringWicket] = useState(false);
  const [wicketType, setWicketType] = useState('Bowled');
  const [dismissedBatter, setDismissedBatter] = useState(state.strikerName);

  // Retire form state
  const [isEnteringRetire, setIsEnteringRetire] = useState(false);
  const [retireTarget, setRetireTarget] = useState(state.strikerName);

  // Shared next batter
  const [nextBatterName, setNextBatterName] = useState('');

  // NEW: No Ball Modal State
  const [isNoBallModalOpen, setIsNoBallModalOpen] = useState(false);
  const [noBallRuns, setNoBallRuns] = useState(0);

  // Active batters
  const battersList = getActiveBatters(state);

  const nextBatters = battersList.filter(
    (b) =>
      b.dismissal === 'Not Out' &&
      b.name !== state.strikerName &&
      b.name !== state.nonStrikerName
  );

  const bowlersList = getActiveBowlers(state);

  const handleBowlerChange = (bowlerName: string) => {
    onStateChange({
      ...state,
      currentBowlerName: bowlerName,
    });
  };

  // Submit wicket
  const handleSubmitWicket = () => {
    const nextBatter = nextBatterName || nextBatters[0]?.name || '';

    onStateChange(
      addWicket(state, wicketType, dismissedBatter, nextBatter)
    );

    setIsEnteringWicket(false);
    setWicketType('Bowled');
    setNextBatterName('');
  };

  // Submit retire
  const handleSubmitRetire = () => {
    const nextBatter = nextBatterName || nextBatters[0]?.name || '';

    onStateChange(
      retireBatter(state, retireTarget, nextBatter)
    );

    setIsEnteringRetire(false);
    setNextBatterName('');
  };

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
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >

      {/* Read-only Banner */}
      {readOnly && !state.isMatchComplete && (
        <div className="readonly-banner">
          <p
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--orange)',
            }}
          >
            Read-Only Spectator Mode
          </p>

          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginTop: '4px',
            }}
          >
            You are viewing a live feed. Only the active editor can record runs.
          </p>
        </div>
      )}

      {/* Scoring Grid */}
      {!state.isMatchComplete &&
        !readOnly &&
        !isEnteringWicket &&
        !isEnteringRetire && (
          <div>

            <div className="scoring-grid">

              {/* DOT, 1, 2, 3 */}
              <button
                className="score-btn runs"
                disabled={disabled}
                onClick={() => onStateChange(addDot(state))}
              >
                ·
              </button>

              {[1, 2, 3].map((run) => (
                <button
                  key={run}
                  className="score-btn runs"
                  disabled={disabled}
                  onClick={() => onStateChange(addRuns(state, run))}
                >
                  {run}
                </button>
              ))}

              {/* 4, 6, WD, NB */}
              <button
                className="score-btn boundary"
                disabled={disabled}
                onClick={() => onStateChange(addRuns(state, 4))}
              >
                4
              </button>

              <button
                className="score-btn boundary"
                disabled={disabled}
                onClick={() => onStateChange(addRuns(state, 6))}
              >
                6
              </button>

              <button
                className="score-btn extras"
                disabled={disabled}
                onClick={() => onStateChange(addWide(state, 0))}
              >
                WD
              </button>

              {/* NEW NB BUTTON */}
              <button
                className="score-btn extras"
                disabled={disabled}
                onClick={() => {
                  setNoBallRuns(0);
                  setIsNoBallModalOpen(true);
                }}
              >
                NB
              </button>

              {/* WKT, BYE, LB, UNDO */}
              <button
                className="score-btn wicket"
                disabled={disabled}
                onClick={triggerWicketForm}
              >
                WKT
              </button>

              <button
                className="score-btn byes"
                disabled={disabled}
                onClick={() => onStateChange(addBye(state, 1))}
              >
                BYE
              </button>

              <button
                className="score-btn byes"
                disabled={disabled}
                onClick={() => onStateChange(addLegBye(state, 1))}
              >
                LB
              </button>

              <button
                className="score-btn undo"
                disabled={
                  state.deliveries.length === 0 ||
                  isEnteringWicket ||
                  isEnteringRetire
                }
                onClick={() => onStateChange(undoLastDelivery(state))}
              >
                ↩ Undo
              </button>
            </div>

            {/* Swap Strike + Retire */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '24px',
                padding: '8px 0 0',
              }}
            >
              <button
                className="btn-text"
                disabled={isEnteringWicket || isEnteringRetire}
                onClick={() => onStateChange(swapStrike(state))}
              >
                Swap Strike
              </button>

              <button
                className="btn-text destructive"
                disabled={isEnteringWicket || isEnteringRetire}
                onClick={triggerRetireForm}
              >
                Retire
              </button>
            </div>
          </div>
        )}

      {/* NO BALL MODAL */}
      {isNoBallModalOpen && (
        <div className="modal-overlay">

          <div className="modal-card">

            <h3
              style={{
                fontSize: '18px',
                fontWeight: 700,
              }}
            >
              No Ball Runs
            </h3>

            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}
            >
              Select additional runs scored
            </p>

            {/* Quick run buttons */}
            <div className="run-options">
              {[0, 1, 2, 3, 4, 6].map((run) => (
                <button
                  key={run}
                  className={`run-pill ${
                    noBallRuns === run ? 'active' : ''
                  }`}
                  onClick={() => setNoBallRuns(run)}
                >
                  {run}
                </button>
              ))}
            </div>

            {/* +/- Controls */}
            <div className="adjuster">

              <button
                onClick={() =>
                  setNoBallRuns((r) => Math.max(0, r - 1))
                }
              >
                −
              </button>

              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  minWidth: '40px',
                  textAlign: 'center',
                }}
              >
                {noBallRuns}
              </span>

              <button
                onClick={() =>
                  setNoBallRuns((r) => r + 1)
                }
              >
                +
              </button>
            </div>

            {/* Actions */}
            <div className="modal-actions">

              <button
                className="btn-text"
                onClick={() => setIsNoBallModalOpen(false)}
              >
                Cancel
              </button>

              <button
                className="btn-primary"
                onClick={() => {
                  onStateChange(addNoBall(state, noBallRuns));
                  setIsNoBallModalOpen(false);
                }}
              >
                Confirm NB + {noBallRuns}
              </button>

            </div>

          </div>
        </div>
      )}

      {/* Wicket Form */}
      {isEnteringWicket && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >

          <h3
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--destructive)',
            }}
          >
            Record Wicket
          </h3>

          {/* Wicket form content unchanged */}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-primary destructive"
              onClick={handleSubmitWicket}
            >
              Confirm Wicket
            </button>

            <button
              className="btn-text"
              onClick={() => setIsEnteringWicket(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Retire Form */}
      {isEnteringRetire && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >

          <h3
            style={{
              fontSize: '15px',
              fontWeight: 700,
            }}
          >
            Retire Batter
          </h3>

          {/* Retire form content unchanged */}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-primary"
              onClick={handleSubmitRetire}
            >
              Confirm Retire
            </button>

            <button
              className="btn-text"
              onClick={() => setIsEnteringRetire(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* End Innings */}
      {showEndInnings && (
        <button
          className="btn-primary green"
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
        >
          <span>End Innings</span>

          <span
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginTop: '4px',
            }}
          >
            Switch to {state.teamBowling} batting next
          </span>
        </button>
      )}
    </div>
  );
}
