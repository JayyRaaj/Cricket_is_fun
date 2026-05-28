import { MatchState, INITIAL_STATE } from './types';

/**
 * Serialize match state to a Base64 encoded JSON string
 */
export function serializeState(state: MatchState): string {
  try {
    const json = JSON.stringify(state);
    // Use btoa for Base64 encoding — works in browser
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
    // Basic validation: check required fields exist
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
 * Parse the URL hash fragment into key-value pairs.
 * Format: #state=<base64>&token=<uuid>
 */
function parseHash(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return {};
  const pairs: Record<string, string> = {};
  const parts = hash.slice(1).split('&');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      pairs[part.slice(0, eqIdx)] = part.slice(eqIdx + 1);
    }
  }
  return pairs;
}

/**
 * Build a hash string from key-value pairs.
 */
function buildHash(pairs: Record<string, string>): string {
  return Object.entries(pairs)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

/**
 * Write match state + optional edit token to the URL hash fragment.
 * Format: #state=<base64>&token=<uuid>
 */
export function writeStateToHash(state: MatchState, token?: string): void {
  if (typeof window === 'undefined') return;
  const encoded = serializeState(state);
  if (!encoded) return;

  const pairs: Record<string, string> = { state: encoded };
  if (token) {
    pairs.token = token;
  } else {
    // Preserve existing token if present
    const existing = parseHash();
    if (existing.token) {
      pairs.token = existing.token;
    }
  }

  const url = new URL(window.location.href);
  url.hash = buildHash(pairs);
  window.history.replaceState(null, '', url.toString());
}

/**
 * Read match state from the URL hash fragment.
 */
export function readStateFromHash(): MatchState | null {
  const pairs = parseHash();
  if (!pairs.state) return null;
  return deserializeState(pairs.state);
}

/**
 * Read the edit token from the URL hash fragment.
 */
export function readTokenFromHash(): string | null {
  const pairs = parseHash();
  return pairs.token || null;
}

/**
 * Generate a shareable URL with the current state (read-only, no edit token).
 */
export function getShareableUrl(state: MatchState): string {
  if (typeof window === 'undefined') return '';
  const encoded = serializeState(state);
  const url = new URL(window.location.href);
  url.hash = `state=${encoded}`;
  return url.toString();
}

/**
 * Generate a hand-off URL that includes the state AND a new edit token.
 * The recipient of this URL becomes the editor.
 */
export function getHandOffUrl(state: MatchState, newToken: string): string {
  if (typeof window === 'undefined') return '';
  const encoded = serializeState(state);
  const url = new URL(window.location.href);
  url.hash = `state=${encoded}&token=${newToken}`;
  return url.toString();
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
