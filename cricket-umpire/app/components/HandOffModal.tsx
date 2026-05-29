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

type ModalStage =
  | 'loading'     // Writing token to Upstash
  | 'ready'       // Show Share + QR options
  | 'qr'          // QR code expanded
  | 'success';    // Handed off — green checkmark

export default function HandOffModal({
  matchId,
  onClose,
  onTokenHandedOff,
  isLocalFallback = false,
}: HandOffModalProps) {
  const [stage, setStage] = useState<ModalStage>('loading');
  const [handOffToken] = useState(() => generateToken());
  const [handOffUrl, setHandOffUrl] = useState('');
  const [qrVisible, setQrVisible] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Step 1: Write token to Upstash, then show options
  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share);

    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/match/${matchId}#token=${handOffToken}`
        : getHandOffUrl(matchId, handOffToken);

    console.log('[HandOff] URL:', url);
    setHandOffUrl(url);

    const writeToken = async () => {
      try {
        // Persist the new token in Upstash so the receiving device can claim it
        await fetch(`/api/match/${matchId}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handOffToken }),
        });
      } catch (err) {
        // Non-fatal — URL still works for local/QR flows
        console.warn('[HandOff] Upstash write failed (non-fatal):', err);
      } finally {
        setStage('ready');
      }
    };

    writeToken();

    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, [matchId, handOffToken]);

  // Trigger success state then close
  const triggerSuccess = useCallback(() => {
    setStage('success');
    onTokenHandedOff(handOffToken);
    successTimerRef.current = setTimeout(() => {
      onClose();
    }, 2000);
  }, [handOffToken, onTokenHandedOff, onClose]);

  // Share via native sheet (AirDrop / Nearby Share / etc.)
  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: 'Cricket Match — Hand Off Scoring',
        text: 'Take over scoring for this cricket match',
        url: handOffUrl,
      });
      triggerSuccess();
    } catch (err) {
      // User dismissed share sheet — no-op
      if ((err as DOMException)?.name !== 'AbortError') {
        console.error('[HandOff] Share error:', err);
      }
    }
  }, [handOffUrl, triggerSuccess]);

  const handleToggleQr = useCallback(() => {
    if (stage === 'qr') {
      setQrVisible(false);
      setStage('ready');
    } else {
      setQrVisible(true);
      setStage('qr');
    }
  }, [stage]);

  const handleClose = useCallback(() => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    onClose();
  }, [onClose]);

  return (
    <>
      {/* Inline keyframes — scoped, no global stylesheet needed */}
      <style>{`
        @keyframes hom-fade-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes hom-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes hom-qr-expand {
          from { opacity: 0; transform: scaleY(0.85); }
          to   { opacity: 1; transform: scaleY(1);    }
        }
        @keyframes hom-success-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
        .hom-card {
          animation: hom-fade-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .hom-qr-wrap {
          transform-origin: top center;
          animation: hom-qr-expand 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .hom-checkmark {
          animation: hom-success-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .hom-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: hom-spin 0.7s linear infinite;
        }
      `}</style>

      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '0 0 env(safe-area-inset-bottom, 0)',
        }}
      >
        {/* Backdrop */}
        <div
          onClick={handleClose}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        />

        {/* Sheet card */}
        <div
          className="hom-card"
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: 420,
            background: 'var(--surface, #1c1c1e)',
            borderRadius: '20px 20px 0 0',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
            overflow: 'hidden',
          }}
        >
          {/* Drag handle */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 12,
            paddingBottom: 4,
          }}>
            <div style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.2)',
            }} />
          </div>

          {/* Header */}
          <div style={{ padding: '12px 24px 20px', textAlign: 'center' }}>
            <h2 style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text, #fff)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}>
              Hand Off Scoring
            </h2>
            <p style={{
              fontSize: 13,
              color: 'var(--text-secondary, rgba(255,255,255,0.5))',
              marginTop: 3,
              marginBottom: 0,
              fontWeight: 400,
              lineHeight: 1.4,
            }}>
              Transfer editor rights to another device
            </p>
          </div>

          {/* ── Loading ── */}
          {stage === 'loading' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '8px 24px 28px',
            }}>
              <div className="hom-spinner" />
              <p style={{
                fontSize: 13,
                color: 'var(--text-secondary, rgba(255,255,255,0.5))',
                margin: 0,
              }}>
                Preparing handoff…
              </p>
            </div>
          )}

          {/* ── Ready / QR ── */}
          {(stage === 'ready' || stage === 'qr') && (
            <div style={{ padding: '0 16px' }}>

              {/* 1. Share via AirDrop / Apps */}
              {canNativeShare && (
                <button
                  onClick={handleNativeShare}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: 14,
                    border: 'none',
                    background: 'var(--accent, #0a84ff)',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    cursor: 'pointer',
                    marginBottom: 10,
                  }}
                >
                  {/* iOS share arrow-up-from-box icon */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  Share via AirDrop or Apps
                </button>
              )}

              {/* 2. Show / Hide QR Code */}
              <button
                onClick={handleToggleQr}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: 14,
                  border: '1.5px solid var(--border, rgba(255,255,255,0.15))',
                  background: 'transparent',
                  color: 'var(--text, #fff)',
                  fontSize: 16,
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  marginBottom: 0,
                }}
              >
                {/* QR icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="3" height="3" rx="0.5" />
                  <rect x="18" y="14" width="3" height="3" rx="0.5" />
                  <rect x="14" y="18" width="3" height="3" rx="0.5" />
                  <rect x="18" y="18" width="3" height="3" rx="0.5" />
                </svg>
                {stage === 'qr' ? 'Hide QR Code' : 'Show QR Code'}
              </button>

              {/* QR expansion */}
              {stage === 'qr' && (
                <div
                  className="hom-qr-wrap"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '20px 0 4px',
                  }}
                >
                  <div style={{
                    background: '#ffffff',
                    borderRadius: 16,
                    padding: 16,
                    display: 'inline-flex',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                  }}>
                    {handOffUrl ? (
                      <QRCodeSVG
                        value={handOffUrl}
                        size={200}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#000000"
                      />
                    ) : (
                      <div style={{
                        width: 200,
                        height: 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#999',
                        fontSize: 13,
                      }}>
                        Generating…
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Spacer */}
              <div style={{ height: 16 }} />
            </div>
          )}

          {/* ── Success ── */}
          {stage === 'success' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '4px 24px 28px',
            }}>
              <div
                className="hom-checkmark"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--green, #30d158)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text, #fff)',
                margin: 0,
              }}>
                Handed off
              </p>
              <p style={{
                fontSize: 13,
                color: 'var(--text-secondary, rgba(255,255,255,0.5))',
                margin: 0,
                textAlign: 'center',
                lineHeight: 1.4,
              }}>
                Now in view-only mode
              </p>
            </div>
          )}

          {/* Cancel — only shown when not success */}
          {stage !== 'success' && (
            <div style={{ padding: '0 16px 4px' }}>
              <button
                onClick={handleClose}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-secondary, rgba(255,255,255,0.5))',
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                  letterSpacing: '-0.01em',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}