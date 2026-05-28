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

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-850 hover:bg-slate-800 text-amber-400 rounded-lg border border-slate-700 transition-colors active:scale-95 touch-manipulation cursor-pointer"
            title={`Switch to ${
              theme === 'dark' ? 'Light' : theme === 'light' ? 'Sunlight' : 'Dark'
            } Mode`}
          >
            {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🕶️'}
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
          onClose={() => setShowHandOff(false)}
          onTokenHandedOff={handleTokenHandedOff}
          isLocalFallback={isLocalFallback}
        />
      )}

      {/* Scorecard Modal */}
      {showScorecard && (
        <ScorecardModal
          state={state}
          onClose={() => setShowScorecard(false)}
        />
      )}

      {/* Dynamic WebRTC Handoff Receiver Invitation Banner */}
      {incomingOffer && !isEditor && !isAcceptingHandoff && (
        <div className="w-full bg-indigo-950 border-b border-indigo-800 px-4 py-3 text-center flex flex-col sm:flex-row items-center justify-center gap-3 animate-[slide-down_0.2s_ease-out] relative z-40">
          <span className="text-xs text-indigo-200 font-bold uppercase tracking-wider">
            📥 Incoming Handoff Request! Accept scoring authority for this match?
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => acceptWebRTCHandoff(incomingOffer)}
              className="px-4 py-1.5 text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg transition-colors cursor-pointer"
            >
              Accept Handoff ⚡
            </button>
            <button
              onClick={() => setIncomingOffer(null)}
              className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors cursor-pointer"
            >
              Ignore
            </button>
          </div>
        </div>
      )}

      {/* Callee WebRTC Handoff Connecting Overlay */}
      {isAcceptingHandoff && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="relative flex items-center justify-center w-20 h-20 mx-auto">
              <div className="absolute w-16 h-16 bg-emerald-500/25 rounded-full animate-ping" />
              <div className="absolute w-12 h-12 bg-emerald-500/40 rounded-full animate-pulse" />
              <div className="text-3xl">⚡</div>
            </div>
            <h2 className="text-lg font-black text-white tracking-tight uppercase">
              Connecting Scorer...
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed px-4">
              Establishing a secure peer-to-peer WebRTC DataChannel connection. Please stay on this screen...
            </p>
          </div>
        </div>
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
