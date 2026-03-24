const API_BASE_RAW = import.meta.env.VITE_API_URL?.trim() || '/api';

const toAbsoluteBaseUrl = (): string | null => {
  if (!API_BASE_RAW) {
    return null;
  }

  try {
    return new URL(API_BASE_RAW).toString().replace(/\/$/, '');
  } catch {
    if (typeof window === 'undefined' || !window.location?.origin) {
      return API_BASE_RAW.replace(/\/$/, '');
    }

    try {
      return new URL(API_BASE_RAW, `${window.location.origin}/`)
        .toString()
        .replace(/\/$/, '');
    } catch {
      return API_BASE_RAW.replace(/\/$/, '');
    }
  }
};

const API_BASE_URL = toAbsoluteBaseUrl();

export const isAbsoluteUrl = (url: string): boolean =>
  /^https?:\/\//i.test(url.trim());

export const joinUrl = (base: string, path: string): string | null => {
  const normalizedBase = base.trim();
  const normalizedPath = path.trim();

  if (!normalizedBase || !normalizedPath) return null;

  try {
    return new URL(
      normalizedPath,
      `${normalizedBase.replace(/\/$/, '')}/`
    ).toString();
  } catch {
    return null;
  }
};

export function resolveMediaUrl(url?: string | null): string | null {
  if (typeof url !== 'string') return null;

  const value = url.trim();
  if (!value) return null;

  if (isAbsoluteUrl(value)) {
    try {
      return new URL(value).toString();
    } catch {
      return null;
    }
  }

  const normalizedPath = value.startsWith('/') ? value : `/${value}`;

  if (!API_BASE_URL) {
    return normalizedPath;
  }

  return joinUrl(API_BASE_URL, normalizedPath);
}

export const dedupeUrls = (
  urls?: Array<string | null | undefined>
): string[] => {
  const unique = new Set<string>();

  for (const raw of urls ?? []) {
    const resolved = resolveMediaUrl(raw);
    if (resolved) {
      unique.add(resolved);
    }
  }

  return Array.from(unique);
};

export const resolveMediaUrls = (
  urls?: Array<string | null | undefined>
): string[] => dedupeUrls(urls);
