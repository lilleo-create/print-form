export const formatEtaDays = (min?: number | null, max?: number | null) => {
  if (!min || !max || min <= 0 || max <= 0) return null;
  return `${min}–${max} дн.`;
};

export const formatEtaDateRange = (createdAt: string, min?: number | null, max?: number | null) => {
  if (!min || !max || min <= 0 || max <= 0) return null;
  const created = new Date(createdAt);
  const from = new Date(created);
  from.setDate(from.getDate() + min);
  const to = new Date(created);
  to.setDate(to.getDate() + max);

  const fromText = from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const toText = to.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return `${fromText} — ${toText}`;
};
