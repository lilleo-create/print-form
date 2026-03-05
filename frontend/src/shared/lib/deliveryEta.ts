export const formatEtaDays = (min?: number | null, max?: number | null) => {
  if (!min || !max || min <= 0 || max <= 0) return null;
  return `СДЭК: ${min}–${max} дней`;
};

export const formatEtaDateRangeFromDates = (minDate?: string | null, maxDate?: string | null) => {
  if (!minDate || !maxDate) return null;
  const from = new Date(minDate);
  const to = new Date(maxDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;

  const fromText = from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const toText = to.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `Ориентировочно: ${fromText} – ${toText}`;
};

export const formatEtaDateRange = (createdAt: string, min?: number | null, max?: number | null) => {
  if (!min || !max || min <= 0 || max <= 0) return null;
  const created = new Date(createdAt);
  const from = new Date(created);
  from.setDate(from.getDate() + min);
  const to = new Date(created);
  to.setDate(to.getDate() + max);

  const fromText = from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const toText = to.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `Ориентировочно: ${fromText} – ${toText}`;
};
