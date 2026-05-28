'use client';

import { useCallback, useState } from 'react';
import { MatchState } from './lib/types';
import { generateToken, saveTokenToStorage } from './lib/state-serializer';
import MatchSetup from './components/MatchSetup';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When match starts, generate a fresh edit token, call POST /api/match, and redirect to dynamic page
  const handleMatchStart = useCallback(async (setupState: MatchState) => {
    setLoading(true);
    setError(null);
    try {
      const token = generateToken();
      
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: setupState,
          token,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create match on server');
      }

      const { matchId } = await response.json();
      
      // Save token to localStorage to identify this client as the creator/editor
      saveTokenToStorage(token);
      
      // Navigate to /match/[matchId]#token=UUID
      // Using window.location to ensure hash navigation is handled cleanly
      window.location.href = `/match/${matchId}#token=${token}`;
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong while starting the match.');
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🏏</div>
          <p className="text-slate-400 text-lg">Initializing match on server...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="bg-red-900/80 border border-red-700 text-red-100 px-4 py-3 text-center text-sm font-semibold">
          Error: {error}
        </div>
      )}
      <MatchSetup onStart={handleMatchStart} />
    </>
  );
}
