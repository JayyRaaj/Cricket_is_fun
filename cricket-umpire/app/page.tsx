'use client';

import { useState, useEffect, useCallback } from 'react';
import { MatchState, INITIAL_STATE } from './lib/types';
import { writeStateToHash, readStateFromHash, getShareableUrl } from './lib/state-serializer';
import Scoreboard from './components/Scoreboard';
import DeliveryLog from './components/DeliveryLog';
import ScoringControls from './components/ScoringControls';
import MatchSetup from './components/MatchSetup';

export default function Home() {
  const [state, setState] = useState<MatchState>(INITIAL_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  // On mount: read state from URL hash
  useEffect(() => {
    const restored = readStateFromHash();
    if (restored) {
      setState(restored);
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
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Sync state to URL hash on every state change
  const handleStateChange = useCallback((newState: MatchState) => {
    setState(newState);
    writeStateToHash(newState);
  }, []);

  // Share URL to clipboard
  const handleShare = useCallback(() => {
    const url = getShareableUrl(state);
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }).catch(() => {
      // Fallback for older browsers
      prompt('Copy this URL to share:', url);
    });
  }, [state]);

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
    return <MatchSetup onStart={handleStateChange} />;
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
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600 font-mono uppercase tracking-wider">
            {state.currentInnings === 1 ? '1st Inn' : '2nd Inn'}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            vs {state.teamBowling}
          </span>
          <button
            onClick={handleShare}
            className="ml-2 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg border border-slate-700 transition-colors active:scale-95 touch-manipulation"
            title="Copy shareable URL"
          >
            📋 Share
          </button>
        </div>
      </header>

      {/* Toast notification */}
      {shareToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-xl animate-[fade-in_0.2s_ease-out]">
          ✓ URL copied to clipboard!
        </div>
      )}

      {/* Content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Scoreboard */}
        <Scoreboard state={state} />

        {/* Delivery Log */}
        <DeliveryLog
          deliveries={state.deliveries}
          totalOvers={state.totalOvers}
        />

        {/* Scoring Controls */}
        <ScoringControls
          state={state}
          onStateChange={handleStateChange}
        />

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-700 pb-4">
          State auto-saved in URL • Bookmark to resume later
        </p>
      </div>
    </main>
  );
}
