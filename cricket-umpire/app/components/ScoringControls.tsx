'use client';

import { useState } from 'react';
import { MatchState, BatterStats, BowlerStats } from '../lib/types';
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

  // Inline forms state
  const [isEnteringWicket, setIsEnteringWicket] = useState(false);
  const [wicketType, setWicketType] = useState('Bowled');
  const [dismissedBatter, setDismissedBatter] = useState(state.strikerName);

  const [isEnteringRetire, setIsEnteringRetire] = useState(false);
  const [retireTarget, setRetireTarget] = useState(state.strikerName);

  const [nextBatterName, setNextBatterName] = useState('');

  // Get eligible next batters (Not Out, and not currently on strike or non-striker)
  const battersList = getActiveBatters(state);
  const nextBatters = battersList.filter(
    (b) =>
      b.dismissal === 'Not Out' &&
      b.name !== state.strikerName &&
      b.name !== state.nonStrikerName
  );

  const bowlersList = getActiveBowlers(state);

  // Handle bowler selection from dropdown
  const handleBowlerChange = (bowlerName: string) => {
    onStateChange({
      ...state,
      currentBowlerName: bowlerName,
    });
  };

  // Submit Wicket Form
  const handleSubmitWicket = () => {
    const nextBatter = nextBatterName || nextBatters[0]?.name || '';
    onStateChange(addWicket(state, wicketType, dismissedBatter, nextBatter));
    
    // Reset form state
    setIsEnteringWicket(false);
    setWicketType('Bowled');
    setNextBatterName('');
  };

  // Submit Retire Form
  const handleSubmitRetire = () => {
    const nextBatter = nextBatterName || nextBatters[0]?.name || '';
    onStateChange(retireBatter(state, retireTarget, nextBatter));
    
    // Reset form state
    setIsEnteringRetire(false);
    setNextBatterName('');
  };

  // Triggers
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
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* 1. Read-only Warning banner */}
      {readOnly && !state.isMatchComplete && (
        <div className="readonly-banner">
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--orange)' }}>
            Read-Only Spectator Mode
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            You are viewing a live feed. Only the active editor can record runs.
          </p>
        </div>
      )}

      {/* 2. Bowler Selector — horizontal pill scroll
      {!disabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span className="label-caps" style={{ paddingLeft: '4px' }}>Bowler</span>
          <div className="bowler-scroll">
            {bowlersList.map((bowler, idx) => (
              <button
                key={idx}
                className={`bowler-pill${state.currentBowlerName === bowler.name ? ' active' : ''}`}
                onClick={() => handleBowlerChange(bowler.name)}
              >
                {bowler.name} {formatOvers(bowler.balls)}
              </button>
            ))}
          </div>
        </div>
      )} */}

      {/* 3. Scoring Circle Buttons — 4-column grid */}
      {!state.isMatchComplete && !readOnly && !isEnteringWicket && !isEnteringRetire && (
        <div>
          <div className="scoring-grid">
            {/* Row 1: DOT, 1, 2, 3 */}
            <button
              className="score-btn runs"
              disabled={disabled}
              onClick={() => onStateChange(addDot(state))}
              title="Dot ball"
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

            {/* Row 2: 4, 6, WD, NB */}
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
            <button
  className="score-btn extras"
  disabled={disabled}
  onClick={() => {
    const input = window.prompt(
      'Additional runs scored off the no-ball?\n\nExamples:\n0 = only NB\n1 = NB + single\n4 = NB boundary',
      '0'
    );

    if (input === null) return;

    const additionalRuns = parseInt(input, 10);

    if (isNaN(additionalRuns) || additionalRuns < 0) {
      alert('Please enter a valid number');
      return;
    }

    onStateChange(addNoBall(state, additionalRuns));
  }}
>
  NB
</button>

            {/* Row 3: WKT, BYE, LB, UNDO */}
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
              disabled={state.deliveries.length === 0 || isEnteringWicket || isEnteringRetire}
              onClick={() => onStateChange(undoLastDelivery(state))}
            >
              ↩ Undo
            </button>
          </div>

          {/* Swap Strike + Retire — text buttons below grid */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '24px',
            padding: '8px 0 0',
          }}>
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

      {/* 4. Dynamic Wicket Recording Form */}
      {isEnteringWicket && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--destructive)',
              letterSpacing: '0.02em',
            }}>
              Record Wicket
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="label-caps">Dismissal</label>
              <select
                className="input-field"
                value={wicketType}
                onChange={(e) => setWicketType(e.target.value)}
              >
                {['Bowled', 'Caught', 'LBW', 'Stumped', 'Run Out', 'Retired', 'Hit Wicket'].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="label-caps">Who is Out?</label>
              <select
                className="input-field"
                value={dismissedBatter}
                onChange={(e) => setDismissedBatter(e.target.value)}
              >
                <option value={state.strikerName}>{state.strikerName} (Striker)</option>
                <option value={state.nonStrikerName}>{state.nonStrikerName} (Non-Striker)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="label-caps">Next Batter</label>
            {nextBatters.length > 0 ? (
              <select
                className="input-field"
                value={nextBatterName}
                onChange={(e) => setNextBatterName(e.target.value)}
              >
                {nextBatters.map((b, idx) => (
                  <option key={idx} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                All out (No batters remaining)
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', paddingTop: '8px' }}>
            <button
              className="btn-primary destructive"
              onClick={handleSubmitWicket}
            >
              Confirm Wicket
            </button>
            <button
              className="btn-text"
              onClick={() => setIsEnteringWicket(false)}
              style={{ flexShrink: 0 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 5. Dynamic Retire Batter Form */}
      {isEnteringRetire && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '0.02em',
          }}>
            Retire Batter
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="label-caps">Retire Target</label>
              <select
                className="input-field"
                value={retireTarget}
                onChange={(e) => setRetireTarget(e.target.value)}
              >
                <option value={state.strikerName}>{state.strikerName} (Striker)</option>
                <option value={state.nonStrikerName}>{state.nonStrikerName} (Non-Striker)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="label-caps">Next Batter</label>
              {nextBatters.length > 0 ? (
                <select
                  className="input-field"
                  value={nextBatterName}
                  onChange={(e) => setNextBatterName(e.target.value)}
                >
                  {nextBatters.map((b, idx) => (
                    <option key={idx} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No batters remaining
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', paddingTop: '8px' }}>
            <button
              className="btn-primary"
              onClick={handleSubmitRetire}
            >
              Confirm Retire
            </button>
            <button
              className="btn-text"
              onClick={() => setIsEnteringRetire(false)}
              style={{ flexShrink: 0 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 6. End Innings Button */}
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
          <span style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            marginTop: '4px',
          }}>
            Switch to {state.teamBowling} batting next
          </span>
        </button>
      )}
    </div>
  );
}
