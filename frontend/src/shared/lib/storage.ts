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
