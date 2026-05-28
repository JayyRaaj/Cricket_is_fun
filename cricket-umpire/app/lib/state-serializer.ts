import { MatchState } from './types';

/**
 * Generate a dynamic base URL that works on localhost AND production.
 * Forces https in production, but keeps http for localhost.
 */
function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://cricket-is-fun.vercel.app';
  }
  const origin = window.location.origin;
  return origin.includes('localhost') ? origin : origin.replace(/^http:/, 'https:');
}

/**
 * Generate a shareable URL with only the match ID (read-only, no edit token).
 */
export function getShareableUrl(matchId: string, fallbackState?: MatchState): string {
  const base = getBaseUrl();
  if (fallbackState) {
    const encoded = serializeState(fallbackState);
    return `${base}/match/${matchId}#state=${encoded}`;
  }
  return `${base}/match/${matchId}`;
}

/**
 * Generate a hand-off URL that includes the match ID AND the new edit token.
 */
export function getHandOffUrl(matchId: string, newToken: string, fallbackState?: MatchState): string {
  const base = getBaseUrl();
  if (fallbackState) {
    const encoded = serializeState(fallbackState);
    return `${base}/match/${matchId}#token=${newToken}&state=${encoded}`;
  }
  return `${base}/match/${matchId}#token=${newToken}`;
}

/**
 * Read the edit token from the URL hash fragment.
 */
export function readTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  const match = hash.match(/token=([^&]+)/);
  return match ? match[1] : null;
}

/**
 * Read the fallback match state from the URL hash fragment.
 */
export function readStateFromHash(): MatchState | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  const match = hash.match(/state=([^&]+)/);
  if (!match) return null;
  return deserializeState(match[1]);
}

/**
 * Serialize match state to a Base64 encoded JSON string
 */
export function serializeState(state: MatchState): string {
  try {
    const json = JSON.stringify(state);
    return btoa(encodeURIComponent(json));
  } catch {
    console.error('Failed to serialize state');
    return '';
  }
}

/**
 * Deserialize match state from a Base64 encoded JSON string
 */
export function deserializeState(encoded: string): MatchState | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const parsed = JSON.parse(json);
    if (
      typeof parsed.totalOvers === 'number' &&
      typeof parsed.totalRuns === 'number' &&
      typeof parsed.totalWickets === 'number' &&
      Array.isArray(parsed.deliveries)
    ) {
      return parsed as MatchState;
    }
    return null;
  } catch {
    console.error('Failed to deserialize state');
    return null;
  }
}

/**
 * Generate a UUID v4 using crypto.randomUUID or fallback.
 */
export function generateToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- localStorage helpers for edit token ---

const TOKEN_STORAGE_KEY = 'cricket-umpire-edit-token';

export function saveTokenToStorage(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage might be unavailable (private browsing, etc.)
  }
}

export function getTokenFromStorage(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearTokenFromStorage(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}
