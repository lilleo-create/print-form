const API_BASE_RAW = import.meta.env.VITE_API_URL?.trim() || '/api';

const toAbsoluteBaseUrl = (): string | null => {
  if (!API_BASE_RAW) {
    return null;
  }

  try {
    const absolute = new URL(API_BASE_RAW);
    return absolute.toString().replace(/\/$/, '');
  } catch {
    if (typeof window === 'undefined' || !window.location?.origin) {
      return API_BASE_RAW.replace(/\/$/, '');
    }

    try {
      return new URL(API_BASE_RAW, `${window.location.origin}/`).toString().replace(/\/$/, '');
    } catch {
      return API_BASE_RAW.replace(/\/$/, '');
    }
  }
};

const API_BASE_URL = toAbsoluteBaseUrl();

export function resolveMediaUrl(url?: string | null): string | null {
  if (typeof url !== 'string') return null;

  const value = url.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (!API_BASE_URL) {
    return value.startsWith('/') ? value : `/${value}`;
  }

  if (value.startsWith('/uploads/')) {
    return `${API_BASE_URL}${value}`;
  }

  if (value.startsWith('uploads/')) {
    return `${API_BASE_URL}/${value}`;
  }

  if (value.startsWith('/')) {
    return `${API_BASE_URL}${value}`;
  }

  return `${API_BASE_URL}/${value}`;
}
