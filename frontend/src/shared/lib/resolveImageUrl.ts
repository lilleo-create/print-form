const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:4000';

export function resolveImageUrl(value?: string | null) {
  if (!value) return '';

  // уже абсолютный URL
  if (/^https?:\/\//i.test(value)) return value;

  // любой относительный путь превращаем в абсолютный от API_ORIGIN
  // "/uploads/x.jpg" -> "http://localhost:4000/uploads/x.jpg"
  // "uploads/x.jpg"  -> "http://localhost:4000/uploads/x.jpg"
  return new URL(value.startsWith('/') ? value : `/${value}`, API_ORIGIN).toString();
}
