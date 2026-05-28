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
 * Write match state to the URL hash fragment
 * Uses #state=<base64> format
 */
export function writeStateToHash(state: MatchState): void {
  if (typeof window === 'undefined') return;
  const encoded = serializeState(state);
  if (encoded) {
    // Use replaceState to avoid polluting browser history
    const url = new URL(window.location.href);
    url.hash = `state=${encoded}`;
    window.history.replaceState(null, '', url.toString());
  }
}

/**
 * Read match state from the URL hash fragment
 * Returns null if no valid state found
 */
export function readStateFromHash(): MatchState | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#state=')) return null;
  const encoded = hash.slice('#state='.length);
  if (!encoded) return null;
  return deserializeState(encoded);
}

/**
 * Generate a shareable URL with the current state
 */
export function getShareableUrl(state: MatchState): string {
  if (typeof window === 'undefined') return '';
  const encoded = serializeState(state);
  const url = new URL(window.location.href);
  url.hash = `state=${encoded}`;
  return url.toString();
}
