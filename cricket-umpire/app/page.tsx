'use client';

import { useState, useEffect, useCallback } from 'react';
import { MatchState, INITIAL_STATE } from './lib/types';
import {
  writeStateToHash,
  readStateFromHash,
  readTokenFromHash,
  getShareableUrl,
  generateToken,
  saveTokenToStorage,
  getTokenFromStorage,
  clearTokenFromStorage,
} from './lib/state-serializer';
import Scoreboard from './components/Scoreboard';
import DeliveryLog from './components/DeliveryLog';
import ScoringControls from './components/ScoringControls';
import MatchSetup from './components/MatchSetup';
import HandOffModal from './components/HandOffModal';

export default function Home() {
  const [state, setState] = useState<MatchState>(INITIAL_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [showHandOff, setShowHandOff] = useState(false);

  // Edit token state
  const [editToken, setEditToken] = useState<string | null>(null);
  const [isEditor, setIsEditor] = useState(true);

  // On mount: read state + token from URL hash, determine editor status
  useEffect(() => {
    const restored = readStateFromHash();
    const urlToken = readTokenFromHash();
    const storedToken = getTokenFromStorage();

    if (restored) {
      setState(restored);
    }

    if (urlToken) {
      // Arriving via a link with an edit token
      if (!storedToken) {
        // First visit — claim the edit token
        saveTokenToStorage(urlToken);
        setEditToken(urlToken);
        setIsEditor(true);
      } else if (storedToken === urlToken) {
        // Returning with same token — still the editor
        setEditToken(storedToken);
        setIsEditor(true);
      } else {
        // URL token differs from stored token — read-only
        setEditToken(storedToken);
        setIsEditor(false);
      }
    } else {
      // No token in URL — this is the original creator or legacy URL
      if (storedToken) {
        setEditToken(storedToken);
        setIsEditor(true);
        // Write token back to hash so it persists
        if (restored) {
          writeStateToHash(restored, storedToken);
        }
      } else {
        // Brand new session — will get a token when match starts
        setIsEditor(true);
      }
    }

    setIsHydrated(true);
  }, []);

  // Listen for hash changes (e.g. browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const restored = readStateFromHash();
      if (restored) {
        setState(restored);
      }
      // Re-check editor status
      const urlToken = readTokenFromHash();
      const storedToken = getTokenFromStorage();
      if (urlToken && storedToken && urlToken !== storedToken) {
        setIsEditor(false);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Sync state to URL hash on every state change (editor only)
  const handleStateChange = useCallback((newState: MatchState) => {
    setState(newState);
    writeStateToHash(newState, editToken || undefined);
  }, [editToken]);

  // When match starts, generate a fresh edit token
  const handleMatchStart = useCallback((newState: MatchState) => {
    const token = generateToken();
    setEditToken(token);
    setIsEditor(true);
    saveTokenToStorage(token);
    setState(newState);
    writeStateToHash(newState, token);
  }, []);

  // Share URL to clipboard (read-only link, no token)
  const handleShare = useCallback(() => {
    const url = getShareableUrl(state);
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }).catch(() => {
      prompt('Copy this URL to share:', url);
    });
  }, [state]);

  // When hand-off is confirmed — current user becomes read-only
  const handleTokenHandedOff = useCallback((newToken: string) => {
    // The new token belongs to the recipient.
    // Current user keeps their old token but is no longer the active editor.
    // We do NOT save the new token — that's for the recipient.
    // Mark ourselves as read-only.
    setIsEditor(false);
    setShowHandOff(false);
  }, []);

  // Don't render until hydrated to prevent flash
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🏏</div>
          <p className="text-slate-500 text-lg">Loading match...</p>
        </div>
      </div>
    );
  }

  // Show setup if match hasn't started
  if (!state.matchStarted) {
    return <MatchSetup onStart={handleMatchStart} />;
  }

  // Main scoring view
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header bar */}
      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/50 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏏</span>
          <h1 className="text-base font-bold text-white tracking-tight">
            Cricket Umpire
          </h1>
          {/* Editor/viewer badge */}
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

          {/* Share (read-only link) */}
          <button
            onClick={handleShare}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg border border-slate-700 transition-colors active:scale-95 touch-manipulation"
            title="Copy read-only link"
          >
            📋
          </button>

          {/* Hand Off (editor only) */}
          {isEditor && (
            <button
              onClick={() => setShowHandOff(true)}
              className="px-2.5 py-1.5 text-xs font-semibold bg-indigo-800 hover:bg-indigo-700 text-indigo-200 rounded-lg border border-indigo-600 transition-colors active:scale-95 touch-manipulation"
              title="Hand off scoring to another umpire"
            >
              📲
            </button>
          )}
        </div>
      </header>

      {/* Toast notification */}
      {shareToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-xl animate-[fade-in_0.2s_ease-out]">
          ✓ Read-only link copied!
        </div>
      )}

      {/* Hand-Off Modal */}
      {showHandOff && (
        <HandOffModal
          state={state}
          onClose={() => setShowHandOff(false)}
          onTokenHandedOff={handleTokenHandedOff}
        />
      )}

      {/* Content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Scoreboard */}
        <Scoreboard state={state} />

       

        {/* Scoring Controls */}
        <ScoringControls
          state={state}
          onStateChange={handleStateChange}
          readOnly={!isEditor}
        />

         {/* Delivery Log */}
        <DeliveryLog
          deliveries={state.deliveries}
          totalOvers={state.totalOvers}
        />

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-700 pb-4">
          {isEditor
            ? 'You are the active editor • State auto-saved in URL'
            : 'Read-only view • Request a hand-off to score'}
        </p>
      </div>
    </main>
  );
}
