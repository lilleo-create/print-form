const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:4000';

export const resolveReturnPhotoUrl = (value?: string | null) => {
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) return value;

  const normalized = value.startsWith('/') ? value : `/${value}`;
  if (normalized.startsWith('/uploads/')) {
    return new URL(normalized, API_ORIGIN).toString();
  }

  if (normalized.startsWith('/uploads')) {
    return new URL(normalized.replace('/uploads', '/uploads/'), API_ORIGIN).toString();
  }

  return new URL(normalized, API_ORIGIN).toString();
};
