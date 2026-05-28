'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { MatchState } from '../lib/types';
import { getHandOffUrl, generateToken } from '../lib/state-serializer';

interface HandOffModalProps {
  state: MatchState;
  onClose: () => void;
  onTokenHandedOff: (newToken: string) => void;
}

export default function HandOffModal({ state, onClose, onTokenHandedOff }: HandOffModalProps) {
  const [handOffToken] = useState(() => generateToken());
  const [handOffUrl, setHandOffUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setHandOffUrl(getHandOffUrl(state, handOffToken));
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, [state, handOffToken]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(handOffUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      prompt('Copy this URL:', handOffUrl);
    }
  }, [handOffUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: `Cricket Match — ${state.teamBatting} vs ${state.teamBowling}`,
        text: `Take over scoring: ${state.teamBatting} ${state.totalRuns}/${state.totalWickets}`,
        url: handOffUrl,
      });
      setShared(true);
      // Mark the hand-off as complete — current user loses edit rights
      onTokenHandedOff(handOffToken);
    } catch (err) {
      // User cancelled the share sheet — that's fine
      if ((err as DOMException)?.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  }, [handOffUrl, state, handOffToken, onTokenHandedOff]);

  const handleConfirmHandOff = useCallback(() => {
    onTokenHandedOff(handOffToken);
    onClose();
  }, [handOffToken, onTokenHandedOff, onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-3 text-center">
          <div className="text-3xl mb-2">📲</div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Hand Off Scoring
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Transfer edit control to another umpire
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center py-4">
          <div className="bg-white p-4 rounded-2xl shadow-lg">
            {handOffUrl ? (
              <QRCodeSVG
                value={handOffUrl}
                size={200}
                level="M"
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            ) : (
              <div className="w-[200px] h-[200px] flex items-center justify-center text-slate-400">
                Generating...
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 px-6">
          Scan this QR code or share the link below.
          <br />
          The recipient will become the active editor.
        </p>

        {/* Actions */}
        <div className="px-6 py-5 space-y-3">
          {/* Native Share (mobile) */}
          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              disabled={shared}
              className="w-full py-4 text-lg font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl transition-all duration-150 active:scale-[0.98] shadow-lg shadow-indigo-900/30 select-none touch-manipulation disabled:opacity-50"
            >
              {shared ? '✓ Shared!' : '📤 Share via AirDrop / Nearby Share'}
            </button>
          )}

          {/* Copy Link */}
          <button
            onClick={handleCopy}
            className="w-full py-3.5 text-base font-bold bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-2xl transition-all duration-150 active:scale-[0.98] select-none touch-manipulation"
          >
            {copied ? '✓ Copied!' : '📋 Copy Hand-Off Link'}
          </button>

          {/* URL preview */}
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mb-1">
              Hand-Off URL
            </p>
            <p className="text-xs text-slate-400 font-mono break-all leading-relaxed select-all">
              {handOffUrl.length > 120
                ? handOffUrl.slice(0, 60) + '...' + handOffUrl.slice(-50)
                : handOffUrl}
            </p>
          </div>

          {/* Confirm hand-off (manual) */}
          <button
            onClick={handleConfirmHandOff}
            className="w-full py-3 text-sm font-semibold bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded-2xl transition-all duration-150 active:scale-[0.98] select-none touch-manipulation"
          >
            🔒 Confirm Hand-Off (go read-only)
          </button>

          {/* Cancel */}
          <button
            onClick={onClose}
            className="w-full py-3 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
