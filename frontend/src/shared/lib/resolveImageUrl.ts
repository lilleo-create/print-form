const API_ORIGIN = import.meta.env.VITE_API_ORIGIN;

const toBaseOrigin = (): string | null => {
  if (typeof API_ORIGIN === 'string' && API_ORIGIN.trim()) {
    try {
      return new URL(API_ORIGIN).origin;
    } catch {
      // Ignore malformed API origin and fallback to window.location.origin.
    }
  }

  if (typeof window !== 'undefined' && typeof window.location?.origin === 'string' && window.location.origin) {
    return window.location.origin;
  }

  return null;
};

export function resolveImageUrl(value?: string | null) {
  if (typeof value !== 'string') return '';

  const normalizedValue = value.trim();
  if (!normalizedValue) return '';

  if (/^https?:\/\//i.test(normalizedValue)) {
    try {
      return new URL(normalizedValue).toString();
    } catch {
      return '';
    }
  }

  const normalizedPath = normalizedValue.startsWith('/') ? normalizedValue : `/${normalizedValue}`;
  const baseOrigin = toBaseOrigin();

  if (!baseOrigin) {
    return normalizedPath;
  }

  try {
    return new URL(normalizedPath, `${baseOrigin}/`).toString();
  } catch {
    return '';
  }
}
