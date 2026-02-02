const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const resolveImageUrl = (url?: string | null) => {
  if (!url) return '';

  // already absolute / data / blob
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  // "/uploads/..." style
  if (url.startsWith('/')) return `${apiBaseUrl}${url}`;

  // "uploads/..." or "some/path"
  return `${apiBaseUrl}/${url}`;
};
