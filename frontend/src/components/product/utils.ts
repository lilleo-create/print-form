const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const resolveImageUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${apiBaseUrl}${url}`;
  return `${apiBaseUrl}/${url}`;
};

export const formatDeliveryDate = (date?: string) => {
  if (date) return date;
  const next = new Date();
  next.setDate(next.getDate() + 3);
  return next.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
};

export const formatReviewDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
