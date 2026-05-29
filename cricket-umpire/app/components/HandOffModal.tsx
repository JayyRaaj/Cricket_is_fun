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
    <div className="modal-overlay">
      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={() => {
          cleanupSignaling();
          cleanupConnection();
          onClose();
        }}
      />

      {/* Modal Card */}
      <div className="modal-card">
        {/* Header */}
        <div style={{
          padding: '24px 24px 8px',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            Hand Off Scoring
          </h2>
          <p style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginTop: 4,
            fontWeight: 400,
            lineHeight: 1.4,
          }}>
            Transfer active editor rights to another device
          </p>
        </div>

        {/* 1. WebRTC Searching State */}
        {isSearchingPeer && !webRTCConnected && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 24px',
            gap: 16,
          }}>
            {/* Pulsing dot — CSS only */}
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'pulse-score 1.5s ease-in-out infinite',
              opacity: 0.8,
            }} />
            <p style={{
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              margin: 0,
            }}>
              Looking for nearby device...
            </p>
          </div>
        )}

        {/* 2. WebRTC Connected State */}
        {webRTCConnected && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 24px',
            gap: 8,
          }}>
            <p style={{
              fontSize: 17,
              fontWeight: 600,
              color: 'var(--green)',
              margin: 0,
            }}>
              Connected
            </p>
            <p style={{
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              margin: 0,
            }}>
              Transferring...
            </p>
          </div>
        )}

        {/* 3. QR Fallback State */}
        {!isSearchingPeer && !webRTCConnected && (
          <div style={{ animation: 'fade-in 0.3s ease-out' }}>
            {/* QR Code */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '16px 24px 8px',
            }}>
              <div style={{
                background: '#ffffff',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {handOffUrl ? (
                  <QRCodeSVG
                    value={handOffUrl}
                    size={160}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                ) : (
                  <div style={{
                    width: 160,
                    height: 160,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                  }}>
                    Generating...
                  </div>
                )}
              </div>
            </div>

            {/* URL preview */}
            <div style={{
              margin: '8px 24px 0',
              padding: '8px 12px',
              background: 'var(--bg)',
              borderRadius: 8,
            }}>
              <p style={{
                fontSize: 11,
                fontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace',
                color: 'var(--text-secondary)',
                margin: 0,
                wordBreak: 'break-all',
                lineHeight: 1.4,
                textAlign: 'center',
                userSelect: 'all',
                WebkitUserSelect: 'all',
              }}>
                {handOffUrl.length > 100
                  ? handOffUrl.slice(0, 50) + '...' + handOffUrl.slice(-40)
                  : handOffUrl}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{
              padding: '16px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              {/* Native share */}
              {canNativeShare && (
                <button
                  className="btn-primary"
                  onClick={handleNativeShare}
                  disabled={shared}
                >
                  {shared ? 'Shared!' : 'Share Link'}
                </button>
              )}

              {/* Copy link */}
              <button
                className="btn-secondary"
                onClick={handleCopy}
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>

              {/* Confirm hand-off */}
              <button
                className="btn-text destructive"
                onClick={handleConfirmHandOff}
                style={{ width: '100%', textAlign: 'center' }}
              >
                Confirm Hand-Off
              </button>
            </div>
          </div>
        )}

        {/* Cancel */}
        <div style={{
          padding: '0 24px 24px',
        }}>
          <button
            className="btn-text"
            onClick={() => {
              cleanupSignaling();
              cleanupConnection();
              onClose();
            }}
            style={{ width: '100%', textAlign: 'center' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
