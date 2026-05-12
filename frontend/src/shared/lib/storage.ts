import { STORAGE_KEYS } from '../constants/storageKeys';

export const loadFromStorage = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const saveToStorage = <T>(key: string, value: T) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
};

export const removeFromStorage = (key: string) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(key);
};

// Access token lives in memory only — never touches localStorage.
// This prevents XSS scripts from reading it via document.cookie / localStorage.
// On page reload the token is gone, but the httpOnly refresh-token cookie
// silently re-issues a new access token on the first 401.
let _accessToken: string | null = null;

export const getAccessToken = (): string | null => _accessToken;

export const setAccessToken = (token: string | null) => {
  _accessToken = token;
  // Clean up any legacy value that may have been stored before this change.
  removeFromStorage(STORAGE_KEYS.accessToken);
};
