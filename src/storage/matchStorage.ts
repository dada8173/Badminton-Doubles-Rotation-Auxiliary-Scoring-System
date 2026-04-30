import type { AppState } from '../types/match';

const STORAGE_KEY = 'badminton-doubles-rotation-auxiliary-scoring-system:v1';

export const loadAppState = (): AppState | undefined => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as AppState;
  } catch {
    return undefined;
  }
};

export const saveAppState = (state: AppState) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearAppState = () => {
  window.localStorage.removeItem(STORAGE_KEY);
};

export const hasSavedAppState = () => Boolean(window.localStorage.getItem(STORAGE_KEY));
