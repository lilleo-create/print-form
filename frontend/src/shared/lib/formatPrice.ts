export const formatPrice = (valueKopecks: number, currency = 'RUB') => {
  const safeValue = Number.isFinite(valueKopecks) ? valueKopecks : 0;

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeValue / 100);
};
