const daysBetween = (date: Date) => {
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((startTarget.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));
};

export const formatDeliveryDate = (dateISO?: string | null, etaDays?: number | null) => {
  if (!dateISO && !etaDays && etaDays !== 0) return '—';

  const date = dateISO ? new Date(dateISO) : new Date(Date.now() + Number(etaDays ?? 0) * 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return '—';

  const diff = daysBetween(date);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === 2) return 'послезавтра';

  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
};
