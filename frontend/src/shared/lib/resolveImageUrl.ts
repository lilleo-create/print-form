const API_ORIGIN = import.meta.env.VITE_API_ORIGIN

export function resolveImageUrl(value?: string | null) {
  if (!value) return '';

  // уже абсолютный URL
  if (/^https?:\/\//i.test(value)) return value;

  return new URL(value.startsWith('/') ? value : `/${value}`, API_ORIGIN).toString();
}
