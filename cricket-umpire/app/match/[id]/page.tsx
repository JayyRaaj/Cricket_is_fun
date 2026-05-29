'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { MatchState, INITIAL_STATE } from '../../lib/types';
import {
  readTokenFromHash,
  getShareableUrl,
  saveTokenToStorage,
  getTokenFromStorage,
  readStateFromHash,
  serializeState,
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

  // WebRTC callee states
  const [incomingOffer, setIncomingOffer] = useState<any>(null);
  const [isAcceptingHandoff, setIsAcceptingHandoff] = useState(false);
  const [isLocalFallback, setIsLocalFallback] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const editTokenRef = useRef(editToken);
  editTokenRef.current = editToken;

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

  const toggleTheme = useCallback(() => {
    let nextTheme: 'dark' | 'light' | 'sunlight' = 'dark';
    if (theme === 'dark') nextTheme = 'light';
    else if (theme === 'light') nextTheme = 'sunlight';
    else nextTheme = 'dark';
    
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, [theme]);

  // On mount: fetch match state from server and check editor status
  useEffect(() => {
    if (!id) return;

    const fetchInitialState = async () => {
      try {
        let token = readTokenFromHash();
        if (!token) {
          token = getTokenFromStorage();
        }

        const headers: Record<string, string> = {};
        if (token) {
          headers['x-edit-token'] = token;
        }

        const res = await fetch(`/api/match/${id}`, { headers });
        if (!res.ok) {
          // If server endpoints fail (e.g. offline dev or static fallback), try reading from hash
          const hashState = readStateFromHash();
          if (hashState) {
            setState(hashState);
            setIsEditor(true);
            setIsLocalFallback(true);
            setIsHydrated(true);
            return;
          }
          if (res.status === 404) {
            throw new Error('Match not found');
          }
          throw new Error('Failed to load match from server');
        }

        const data = await res.json();
        
        setState(data.state);
        setIsEditor(data.isEditor);
        
        const isServerFallback = !!data.isFallback;
        setIsLocalFallback(isServerFallback);

        if (isServerFallback) {
          // If server is in fallback mode, also try to read from hash
          const hashState = readStateFromHash();
          if (hashState) {
            setState(hashState);
          }
        }
        
        if (data.isEditor && token) {
          setEditToken(token);
          saveTokenToStorage(token);
        } else {
          setEditToken(null);
        }

        setIsHydrated(true);
      } catch (err: any) {
        // Fallback to reading state from hash if an exception occurs
        const hashState = readStateFromHash();
        if (hashState) {
          setState(hashState);
          setIsEditor(true);
          setIsLocalFallback(true);
          setIsHydrated(true);
          return;
        }
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
          setState(data.state);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [id, isEditor, isHydrated, error]);

  // WebRTC callee signaling poll: poll for WebRTC offer every 2 seconds if spectator
  useEffect(() => {
    if (!id || isEditor || !isHydrated || error || isAcceptingHandoff) return;

    const signalPoll = setInterval(async () => {
      try {
        const res = await fetch(`/api/match/${id}/signal`);
        if (res.ok) {
          const data = await res.json();
          if (data.signal && data.signal.type === 'offer') {
            setIncomingOffer(data.signal.sdp);
          } else {
            setIncomingOffer(null);
          }
        }
      } catch (err) {
        console.error('Signal poll error:', err);
      }
    }, 2000);

    return () => clearInterval(signalPoll);
  }, [id, isEditor, isHydrated, error, isAcceptingHandoff]);

  // Handle accepting WebRTC Handoff
  const acceptWebRTCHandoff = useCallback(async (offerSdp: any) => {
    setIsAcceptingHandoff(true);
    setIncomingOffer(null);

    try {
      // 1. Create Peer Connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      pcRef.current = pc;

      // 2. Listen for remote DataChannel
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        
        dc.onmessage = async (msgEvent) => {
          try {
            const data = JSON.parse(msgEvent.data);
            if (data.type === 'handoff-transfer') {
              // Received the handoff token over DataChannel.
              // Fetch the full state from Upstash by matchId.
              const token = data.token;
              const res = await fetch(`/api/match/${id}`, {
                headers: { 'x-edit-token': token },
              });
              if (res.ok) {
                const serverData = await res.json();
                setState(serverData.state);
              }

              setIsEditor(true);
              setEditToken(token);
              saveTokenToStorage(token);

              // Set the URL hash to identify as the active editor
              const url = new URL(window.location.href);
              url.hash = `token=${token}`;
              window.history.replaceState(null, '', url.toString());

              // Send Ack back over DataChannel to confirm receipt
              dc.send(JSON.stringify({ type: 'handoff-ack' }));
              
              // Clear KV signal & stop accept loading
              await fetch(`/api/match/${id}/signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signal: null }),
              });

              setIsAcceptingHandoff(false);
              pc.close();
            }
          } catch (err) {
            console.error('DataChannel receiver error:', err);
            setIsAcceptingHandoff(false);
          }
        };
      };

      // 3. Set Remote Description (SDP Offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));

      // 4. Create SDP Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 5. Gather ICE candidates, then publish SDP Answer to KV
      pc.onicecandidate = async (event) => {
        if (!event.candidate) {
          try {
            await fetch(`/api/match/${id}/signal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                signal: { type: 'answer', sdp: pc.localDescription },
              }),
            });
          } catch (err) {
            console.error('Failed to post WebRTC SDP answer:', err);
            setIsAcceptingHandoff(false);
          }
        }
      };

    } catch (err) {
      console.error('Failed to process WebRTC callee handoff:', err);
      setIsAcceptingHandoff(false);
    }
  }, [id]);

  // Handle state change (push state to KV on every ball change / scoring control action)
  const handleStateChange = useCallback(async (newState: MatchState) => {
    if (!newState.matchStarted) {
      window.location.href = '/';
      return;
    }

    setState(newState);

    if (!isEditor || !editTokenRef.current) return;

    if (isLocalFallback) {
      // Offline / Local dev fallback: save state inside the URL hash directly (no spectator sync)
      const url = new URL(window.location.href);
      const serialized = serializeState(newState);
      url.hash = `token=${editTokenRef.current}&state=${serialized}`;
      window.history.replaceState(null, '', url.toString());
      return;
    }

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
  }, [id, isEditor, isLocalFallback]);

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

      setIsEditor(false);
      setEditToken(null);
      setShowHandOff(false);
      
      const url = new URL(window.location.href);
      url.hash = '';
      window.history.replaceState(null, '', url.toString());
    } catch (err) {
      console.error('Failed to transition editor rights:', err);
      alert('Failed to hand off scoring authority. Please try again.');
    }
  }, [id]);

  // ========================================
  // RENDER
  // ========================================

  // Loading state
  if (!isHydrated) {
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
          }}>Connecting...</p>
        </div>
      </div>
    );
  }

  // Error state (e.g. 404 match not found)
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          textAlign: 'center',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          padding: 32,
          maxWidth: 360,
          width: '100%',
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 8,
          }}>Match Not Found</h2>
          <p style={{
            fontSize: 15,
            color: 'var(--text-secondary)',
            marginBottom: 24,
          }}>{error}</p>
          <a
            href="/"
            className="btn-primary"
            style={{
              display: 'block',
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            New Match
          </a>
        </div>
      </div>
    );
  }

  // Truncated match name for nav bar
  const matchName = state.teamBatting && state.teamBowling
    ? `${state.teamBatting} v ${state.teamBowling}`
    : 'Match';

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'background-color 0.2s ease',
    }}>
      {/* ===== Navigation Bar (44px iOS-style) ===== */}
      <nav className="nav-bar">
        <div className="nav-left">
          <a href="/" style={{
            color: 'var(--accent)',
            fontSize: 20,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            minWidth: 44,
            minHeight: 44,
            justifyContent: 'center',
          }}>‹</a>
          <span className="nav-title" style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 180,
          }}>{matchName}</span>
          <span
            className={`status-dot ${isEditor ? 'editor' : 'viewer'}`}
            title={isEditor ? 'Editor' : 'Viewer'}
          />
        </div>
        <div className="nav-right">
          <button
            className="nav-btn"
            onClick={() => setShowScorecard(true)}
            title="Scorecard"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18"/>
              <path d="M9 3v18"/>
            </svg>
          </button>
          <button
            className="nav-btn"
            onClick={toggleTheme}
            title={`${theme === 'dark' ? 'Light' : theme === 'light' ? 'Sunlight' : 'Dark'} mode`}
            style={{ fontSize: 20 }}
          >
            {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '☀️'}
          </button>
        </div>
      </nav>

      {/* ===== Share toast ===== */}
      {shareToast && (
        <div className="toast">
          Link copied
        </div>
      )}

      {/* ===== Hand-Off Modal ===== */}
      {showHandOff && (
        <HandOffModal
          matchId={id}
          onClose={() => setShowHandOff(false)}
          onTokenHandedOff={handleTokenHandedOff}
          isLocalFallback={isLocalFallback}
        />
      )}

      {/* ===== Scorecard Modal ===== */}
      {showScorecard && (
        <ScorecardModal
          state={state}
          onClose={() => setShowScorecard(false)}
        />
      )}

      {/* ===== WebRTC Handoff Receiver Banner ===== */}
      {incomingOffer && !isEditor && !isAcceptingHandoff && (
        <div style={{
          padding: '12px 16px',
          background: 'color-mix(in srgb, var(--accent) 10%, var(--bg))',
          borderBottom: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          flexWrap: 'wrap',
          animation: 'fade-in 0.2s ease',
        }}>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
          }}>Incoming hand-off request</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => acceptWebRTCHandoff(incomingOffer)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                background: 'var(--green)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
                minHeight: 44,
              }}
            >Accept</button>
            <button
              onClick={() => setIncomingOffer(null)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
                minHeight: 44,
              }}
            >Ignore</button>
          </div>
        </div>
      )}

      {/* ===== WebRTC Accepting Overlay ===== */}
      {isAcceptingHandoff && (
        <div className="modal-overlay" style={{ zIndex: 250 }}>
          <div className="modal-backdrop" />
          <div className="modal-card" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--green) 15%, var(--surface))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              animation: 'pulse-score 1.5s ease-in-out infinite',
            }}>
              <span style={{ fontSize: 24 }}>⚡</span>
            </div>
            <h2 style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 8,
            }}>Connecting</h2>
            <p style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>Establishing peer connection...</p>
          </div>
        </div>
      )}

      {/* ===== Innings Break — Full Screen Takeover ===== */}
      {state.currentInnings === 1 && state.isInningsComplete && !state.isMatchComplete && (
        <div className="fullscreen-takeover">
          <div style={{
            textAlign: 'center',
            maxWidth: 360,
            width: '100%',
          }}>
            <p className="label-caps" style={{ marginBottom: 16 }}>
              Innings Complete
            </p>
            <div style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: -2,
              color: 'var(--text)',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {state.totalRuns + 1}
            </div>
            <p style={{
              fontSize: 18,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginTop: 8,
              marginBottom: 48,
            }}>
              target for {state.teamBowling}
            </p>
            
            {isEditor ? (
              <button
                className="btn-primary"
                onClick={() => handleStateChange(endInnings(state))}
              >
                Start 2nd Innings
              </button>
            ) : (
              <p style={{
                fontSize: 15,
                color: 'var(--text-secondary)',
              }}>Waiting for scorer to start 2nd innings...</p>
            )}
          </div>
        </div>
      )}

      {/* ===== Main Content ===== */}
      <div style={{
        flex: 1,
        width: '100%',
        maxWidth: 500,
        margin: '0 auto',
        padding: '0 16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
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

        {/* Action bar: Share & Hand-off (editor only) */}
        {isEditor && !state.isMatchComplete && (
          <div style={{
            display: 'flex',
            gap: 8,
            paddingTop: 8,
          }}>
            <button
              className="btn-text"
              onClick={handleShare}
              style={{ flex: 1, textAlign: 'center' }}
            >
              Share Link
            </button>
            <button
              className="btn-text"
              onClick={() => setShowHandOff(true)}
              style={{ flex: 1, textAlign: 'center' }}
            >
              Hand Off
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
