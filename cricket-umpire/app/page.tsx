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
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 48,
            marginBottom: 16,
            animation: 'pulse-score 1.5s ease-in-out infinite',
          }}>🏏</div>
          <p style={{
            fontSize: 17,
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}>Setting up match...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'color-mix(in srgb, var(--destructive) 10%, var(--bg))',
          borderBottom: '1px solid color-mix(in srgb, var(--destructive) 30%, transparent)',
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--destructive)',
        }}>
          {error}
        </div>
      )}
      <MatchSetup onStart={handleMatchStart} />
    </>
  );
}
