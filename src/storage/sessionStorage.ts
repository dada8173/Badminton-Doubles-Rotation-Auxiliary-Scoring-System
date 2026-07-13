import type { CourtSessionState } from '../types/session';

const SESSION_STORAGE_KEY = 'badminton-court-session-state-v1';

export const saveCourtSession = (session: CourtSessionState) => localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
export const loadCourtSession = (): CourtSessionState | undefined => {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return undefined;
  try { return JSON.parse(raw) as CourtSessionState; } catch { return undefined; }
};
export const clearCourtSession = () => localStorage.removeItem(SESSION_STORAGE_KEY);
export const hasSavedCourtSession = () => Boolean(localStorage.getItem(SESSION_STORAGE_KEY));
