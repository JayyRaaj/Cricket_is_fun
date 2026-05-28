'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { MatchState, INITIAL_STATE } from '../../lib/types';
import {
  readTokenFromHash,
  getShareableUrl,
  saveTokenToStorage,
  getTokenFromStorage,
} from '../../lib/state-serializer';
import Scoreboard from '../../components/Scoreboard';
import DeliveryLog from '../../components/DeliveryLog';
import ScoringControls from '../../components/ScoringControls';
import HandOffModal from '../../components/HandOffModal';
import ScorecardModal from '../../components/ScorecardModal';
import { endInnings } from '../../lib/engine';

export default function MatchPage() {
  const params = useParams();
  const id = params.id as string;

  const [state, setState] = useState<MatchState>(INITIAL_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [showHandOff, setShowHandOff] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor rights state
  const [isEditor, setIsEditor] = useState(false);
  const [editToken, setEditToken] = useState<string | null>(null);

  // Keep ref to latest state and token to avoid capturing stale values in event handlers
  const stateRef = useRef(state);
  stateRef.current = state;
  const editTokenRef = useRef(editToken);
  editTokenRef.current = editToken;

  // On mount: fetch match state from server and check editor status
  useEffect(() => {
    if (!id) return;

    const fetchInitialState = async () => {
      try {
        // 1. Read token from URL hash if present
        let token = readTokenFromHash();

        // 2. Fall back to localStorage if no token is in URL hash
        if (!token) {
          token = getTokenFromStorage();
        }

        // 3. Request match data and verify editor status
        const headers: Record<string, string> = {};
        if (token) {
          headers['x-edit-token'] = token;
        }

        const res = await fetch(`/api/match/${id}`, { headers });
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Match not found');
          }
          throw new Error('Failed to load match from server');
        }

        const data = await res.json();
        
        setState(data.state);
        setIsEditor(data.isEditor);
        
        if (data.isEditor && token) {
          setEditToken(token);
          saveTokenToStorage(token);
        } else {
          setEditToken(null);
        }

        setIsHydrated(true);
      } catch (err: any) {
        console.error('Error hydrating match page:', err);
        setError(err.message || 'An error occurred while loading the match.');
        setIsHydrated(true);
      }
    };

    fetchInitialState();
  }, [id]);

  // Polling for Spectators: fetch latest state every 3 seconds if NOT the editor
  useEffect(() => {
    if (!id || isEditor || !isHydrated || error) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/match/${id}`);
        if (res.ok) {
          const data = await res.json();
          // Only update state if we are still a spectator
          setState(data.state);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [id, isEditor, isHydrated, error]);

  // Handle state change (push state to KV on every ball change / scoring control action)
  const handleStateChange = useCallback(async (newState: MatchState) => {
    if (!newState.matchStarted) {
      // User clicked "New Match" - redirect to home page for setup
      window.location.href = '/';
      return;
    }

    // 1. Instantly update UI locally so the interface feels extremely fast and responsive
    setState(newState);

    if (!isEditor || !editTokenRef.current) return;

    // 2. Push updated state asynchronously to Vercel KV
    try {
      const response = await fetch(`/api/match/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: newState,
          token: editTokenRef.current,
        }),
      });

      if (!response.ok) {
        console.error('Failed to sync state to server:', await response.text());
      }
    } catch (err) {
      console.error('Failed to update state on server:', err);
    }
  }, [id, isEditor]);

  // Share URL to clipboard (read-only link, no token)
  const handleShare = useCallback(() => {
    const url = getShareableUrl(id);
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }).catch(() => {
      prompt('Copy this URL to share:', url);
    });
  }, [id]);

  // Confirm Hand Off: current editor transitions to read-only spectator
  const handleTokenHandedOff = useCallback(async (newToken: string) => {
    if (!editTokenRef.current) return;
    try {
      // Send PUT request to store the new token in KV
      const response = await fetch(`/api/match/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: stateRef.current,
          token: editTokenRef.current,
          newToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update scoring authority on server');
      }

      // Transition client-side editor rights to read-only spectator
      setIsEditor(false);
      setEditToken(null);
      setShowHandOff(false);
      
      // Remove token from hash dynamically
      const url = new URL(window.location.href);
      url.hash = '';
      window.history.replaceState(null, '', url.toString());
    } catch (err) {
      console.error('Failed to transition editor rights:', err);
      alert('Failed to hand off scoring authority. Please try again.');
    }
  }, [id]);

  // Loading state
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🏏</div>
          <p className="text-slate-500 text-lg">Connecting to match server...</p>
        </div>
      </div>
    );
  }

  // Error state (e.g. 404 match not found)
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="text-center bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full">
          <div className="text-5xl mb-4">📭</div>
          <h2 className="text-xl font-bold text-white mb-2">Match Unreachable</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <a
            href="/"
            className="block w-full py-3.5 text-center text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-2xl transition-colors"
          >
            Create New Match
          </a>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header bar */}
      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/50 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏏</span>
          <h1 className="text-base font-bold text-white tracking-tight">
            Cricket Umpire
          </h1>
          {/* Editor/Viewer status badge */}
          {isEditor ? (
            <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-900/60 text-emerald-400 px-1.5 py-0.5 rounded-md border border-emerald-800/40">
              Editor
            </span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-900/60 text-amber-400 px-1.5 py-0.5 rounded-md border border-amber-800/40">
              Viewer
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-600 font-mono uppercase tracking-wider hidden sm:inline">
            {state.currentInnings === 1 ? '1st' : '2nd'}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            vs {state.teamBowling}
          </span>

          {/* Scorecard Button */}
          <button
            onClick={() => setShowScorecard(true)}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-850 hover:bg-slate-800 text-sky-400 rounded-lg border border-slate-700 transition-colors active:scale-95 touch-manipulation cursor-pointer"
            title="Open Scorecard"
          >
            📊
          </button>

          {/* Share (read-only spectator link) */}
          <button
            onClick={handleShare}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-850 hover:bg-slate-800 text-amber-400 rounded-lg border border-slate-700 transition-colors active:scale-95 touch-manipulation cursor-pointer"
            title="Copy spectator link"
          >
            📋
          </button>

          {/* Hand Off scoring authority (editor only) */}
          {isEditor && (
            <button
              onClick={() => setShowHandOff(true)}
              className="px-2.5 py-1.5 text-xs font-semibold bg-indigo-900/80 hover:bg-indigo-850 text-indigo-200 rounded-lg border border-indigo-700/60 transition-colors active:scale-95 touch-manipulation cursor-pointer"
              title="Hand off scoring to another umpire"
            >
              📲
            </button>
          )}
        </div>
      </header>

      {/* Share toast notification */}
      {shareToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-xl animate-[fade-in_0.2s_ease-out]">
          ✓ Spectator link copied!
        </div>
      )}

      {/* Hand-Off Modal */}
      {showHandOff && (
        <HandOffModal
          matchId={id}
          state={state}
          onClose={() => setShowHandOff(false)}
          onTokenHandedOff={handleTokenHandedOff}
        />
      )}

      {/* Scorecard Modal */}
      {showScorecard && (
        <ScorecardModal
          state={state}
          onClose={() => setShowScorecard(false)}
        />
      )}

      {/* Innings Break Modal Display */}
      {state.currentInnings === 1 && state.isInningsComplete && !state.isMatchComplete && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5 animate-[scale-up_0.2s_ease-out]">
            <div className="text-5xl">⛳</div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Innings Break
            </h2>
            <div className="bg-slate-950/50 border border-slate-850 rounded-2xl py-4 px-4">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                First Innings Completed
              </p>
              <p className="text-3xl font-black text-white font-mono mt-1">
                {state.totalRuns}/{state.totalWickets}
              </p>
              <p className="text-xs text-amber-400 mt-2 font-bold uppercase tracking-wider">
                Target: {state.totalRuns + 1} runs
              </p>
            </div>
            
            {/* Start 2nd Innings button (Editor only) */}
            {isEditor ? (
              <button
                onClick={() => handleStateChange(endInnings(state))}
                className="w-full py-4 text-base font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black rounded-2xl transition-all cursor-pointer"
              >
                Start 2nd Innings 🏏
              </button>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Waiting for the active editor to start the 2nd innings...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main scoring / scoreboard content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Scoreboard */}
        <Scoreboard state={state} />

        {/* Scoring Controls (Active scorer options) */}
        <ScoringControls
          state={state}
          onStateChange={handleStateChange}
          readOnly={!isEditor}
        />

        {/* Live Delivery Log */}
        <DeliveryLog
          deliveries={state.deliveries}
          totalOvers={state.totalOvers}
        />

        {/* Footer help info */}
        <p className="text-center text-[10px] text-slate-700 pb-4">
          {isEditor
            ? `You are the active editor • Match ID: ${id} • Autosyncing to server`
            : `Read-only view • Match ID: ${id} • Autosyncing every 3s`}
        </p>
      </div>
    </main>
  );
}
