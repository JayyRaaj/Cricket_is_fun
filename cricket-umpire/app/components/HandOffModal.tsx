'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getHandOffUrl, generateToken } from '../lib/state-serializer';

interface HandOffModalProps {
  matchId: string;
  onClose: () => void;
  onTokenHandedOff: (newToken: string) => void;
  isLocalFallback?: boolean;
}

export default function HandOffModal({
  matchId,
  onClose,
  onTokenHandedOff,
  isLocalFallback = false,
}: HandOffModalProps) {
  const [handOffToken] = useState(() => generateToken());
  const [handOffUrl, setHandOffUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // WebRTC Peer-to-Peer states
  const [isSearchingPeer, setIsSearchingPeer] = useState(true);
  const [webRTCConnected, setWebRTCConnected] = useState(false);
  const [webrtcError, setWebrtcError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const webrtcTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up WebRTC signaling
  const cleanupSignaling = useCallback(async () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (webrtcTimeoutRef.current) clearTimeout(webrtcTimeoutRef.current);
    
    // Delete signal from Vercel KV so it doesn't linger
    try {
      await fetch(`/api/match/${matchId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal: null }),
      });
    } catch (err) {
      console.error('Failed to cleanup WebRTC signal:', err);
    }
  }, [matchId]);

  // Clean up WebRTC connections
  const cleanupConnection = useCallback(() => {
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  }, []);

  // Initiate WebRTC connection
  useEffect(() => {
    // Always generate a short URL — state is in Upstash, never in the URL
    const shortUrl = getHandOffUrl(matchId, handOffToken);
    setHandOffUrl(shortUrl);
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share);

    if (isLocalFallback) {
      // Local fallback mode: skip WebRTC discovery, just show QR
      setIsSearchingPeer(false);
      return;
    }

    let isSubscribed = true;

    const startWebRTCOffer = async () => {
      try {
        // 1. Create Peer Connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });
        pcRef.current = pc;

        // 2. Create DataChannel
        const dc = pc.createDataChannel('handoff', { ordered: true });
        dcRef.current = dc;

        dc.onopen = () => {
          if (!isSubscribed) return;
          setWebRTCConnected(true);
          setIsSearchingPeer(false);
          if (webrtcTimeoutRef.current) clearTimeout(webrtcTimeoutRef.current);

          // Once DataChannel is open, transfer the handoff token instantly!
          // State is stored in Upstash — the receiver fetches it by matchId.
          dc.send(
            JSON.stringify({
              type: 'handoff-transfer',
              token: handOffToken,
            })
          );
        };

        dc.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'handoff-ack') {
              // Recipient successfully received and claimed the token
              cleanupSignaling();
              cleanupConnection();
              onTokenHandedOff(handOffToken);
            }
          } catch (err) {
            console.error('DataChannel parse error:', err);
          }
        };

        // 3. Create SDP Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // 4. Gather ICE Candidates before posting to avoid complex candidate trickling
        pc.onicecandidate = async (event) => {
          if (!event.candidate) {
            if (!isSubscribed) return;
            // All ICE candidates gathered, post full SDP description containing candidates to KV
            try {
              await fetch(`/api/match/${matchId}/signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  signal: { type: 'offer', sdp: pc.localDescription },
                }),
              });
            } catch (err) {
              console.error('Failed to post WebRTC offer:', err);
            }
          }
        };

        // 5. Start Polling for SDP Answer from Callee
        pollIntervalRef.current = setInterval(async () => {
          if (!isSubscribed) return;
          try {
            const response = await fetch(`/api/match/${matchId}/signal`);
            if (response.ok) {
              const data = await response.json();
              if (data.signal && data.signal.type === 'answer') {
                clearInterval(pollIntervalRef.current!);
                pollIntervalRef.current = null;
                
                await pc.setRemoteDescription(
                  new RTCSessionDescription(data.signal.sdp)
                );
              }
            }
          } catch (err) {
            console.error('Failed to poll for WebRTC answer:', err);
          }
        }, 1000);

        // 6. Set 10-Second Timeout for Peer Discovery
        webrtcTimeoutRef.current = setTimeout(async () => {
          if (!isSubscribed) return;
          console.log('WebRTC peer discovery timed out after 10s. Falling back to QR...');
          
          await cleanupSignaling();
          cleanupConnection();
          
          setIsSearchingPeer(false);
        }, 10000);

      } catch (err: any) {
        console.error('Failed to start WebRTC handshake:', err);
        setWebrtcError(err.message || 'WebRTC initialisation failed.');
        setIsSearchingPeer(false);
      }
    };

    startWebRTCOffer();

    return () => {
      isSubscribed = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (webrtcTimeoutRef.current) clearTimeout(webrtcTimeoutRef.current);
      cleanupConnection();
    };
  }, [matchId, handOffToken, onTokenHandedOff, cleanupSignaling, cleanupConnection, isLocalFallback]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(handOffUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt('Copy this URL:', handOffUrl);
    }
  }, [handOffUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: 'Cricket Match — Hand Off Scoring',
        text: 'Take over scoring for this cricket match',
        url: handOffUrl,
      });
      setShared(true);
      await cleanupSignaling();
      cleanupConnection();
      onTokenHandedOff(handOffToken);
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  }, [handOffUrl, handOffToken, onTokenHandedOff, cleanupSignaling, cleanupConnection]);

  const handleConfirmHandOff = useCallback(async () => {
    await cleanupSignaling();
    cleanupConnection();
    onTokenHandedOff(handOffToken);
    onClose();
  }, [handOffToken, onTokenHandedOff, onClose, cleanupSignaling, cleanupConnection]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => {
          cleanupSignaling();
          cleanupConnection();
          onClose();
        }}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 text-center">
          <div className="text-3xl mb-2">📲</div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Hand Off Scoring
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Transfer active editor rights to another umpire
          </p>
        </div>

        {/* 1. Dynamic WebRTC Searching Animation */}
        {isSearchingPeer && !webRTCConnected && (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="relative flex items-center justify-center w-24 h-24">
              <div className="absolute w-20 h-20 bg-indigo-500/25 rounded-full animate-ping" />
              <div className="absolute w-16 h-16 bg-indigo-500/40 rounded-full animate-pulse" />
              <div className="relative text-4xl">📡</div>
            </div>
            <p className="text-sm text-slate-300 font-bold animate-pulse">
              Looking for nearby umpire...
            </p>
            <p className="text-[10px] text-slate-500 text-center px-8 leading-relaxed">
              Open this match URL on the receiving device to connect over the same network via WebRTC.
            </p>
          </div>
        )}

        {/* 2. WebRTC Connected Transfer Status */}
        {webRTCConnected && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="text-5xl animate-bounce">⚡</div>
            <p className="text-sm font-bold text-emerald-400">
              WebRTC Peer Connected!
            </p>
            <p className="text-xs text-slate-400">
              Instantly transferring scoring state...
            </p>
          </div>
        )}

        {/* 3. Fallbacks when WebRTC Peer Discovery times out / fails */}
        {!isSearchingPeer && !webRTCConnected && (
          <div className="animate-[fade-in_0.3s_ease-out]">
            {/* QR Code fallback */}
            <div className="flex justify-center py-3">
              <div className="bg-white p-3.5 rounded-2xl shadow-lg border border-slate-200">
                {handOffUrl ? (
                  <QRCodeSVG
                    value={handOffUrl}
                    size={170}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                  />
                ) : (
                  <div className="w-[170px] h-[170px] flex items-center justify-center text-slate-400 text-xs">
                    Generating...
                  </div>
                )}
              </div>
            </div>

            <p className="text-center text-[10px] text-slate-500 px-6 mt-1 leading-relaxed">
              Scan this QR code or use peer share sheet buttons.
              <br />
              The recipient will instantly become the active scorer.
            </p>

            {/* Action buttons with priority order */}
            <div className="px-6 py-4 space-y-2.5">
              {/* Priority (2) Native share sheet / AirDrop */}
              {canNativeShare && (
                <button
                  onClick={handleNativeShare}
                  disabled={shared}
                  className="w-full py-3.5 text-base font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl transition-all duration-150 active:scale-[0.98] shadow-lg shadow-indigo-900/30 select-none touch-manipulation cursor-pointer"
                >
                  {shared ? '✓ Shared!' : '📤 Share via AirDrop / Nearby Share'}
                </button>
              )}

              {/* Priority (3) Copy link fallback */}
              <button
                onClick={handleCopy}
                className="w-full py-3 text-sm font-bold bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-2xl transition-all duration-150 active:scale-[0.98] select-none touch-manipulation cursor-pointer"
              >
                {copied ? '✓ Copied!' : '📋 Copy Hand-Off Link'}
              </button>

              {/* URL Preview */}
              <div className="bg-slate-850/60 rounded-xl p-2.5 border border-slate-800/80">
                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">
                  Hand-Off URL
                </p>
                <p className="text-[10px] text-slate-400 font-mono break-all leading-tight select-all">
                  {handOffUrl.length > 100
                    ? handOffUrl.slice(0, 50) + '...' + handOffUrl.slice(-40)
                    : handOffUrl}
                </p>
              </div>

              {/* Confirm Hand off (manual transition) */}
              <button
                onClick={handleConfirmHandOff}
                className="w-full py-2.5 text-xs font-semibold bg-red-950/40 hover:bg-red-950/60 text-red-400 border border-red-900/30 rounded-xl transition-all duration-150 active:scale-[0.98] select-none touch-manipulation cursor-pointer"
              >
                🔒 Confirm Hand-Off (go read-only)
              </button>
            </div>
          </div>
        )}

        {/* Footer cancel action */}
        <div className="px-6 pb-4 pt-1">
          <button
            onClick={() => {
              cleanupSignaling();
              cleanupConnection();
              onClose();
            }}
            className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            Cancel Handoff
          </button>
        </div>
      </div>
    </div>
  );
}
