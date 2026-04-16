const toSafeKopecks = (valueKopecks: number) => {
  return Number.isFinite(valueKopecks) ? valueKopecks : 0;
};

export const formatPrice = (valueKopecks: number, currency = 'RUB') => {
  const safeValue = toSafeKopecks(valueKopecks);

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeValue / 100);
};

export const formatPriceNoKopecks = (valueKopecks: number, currency = 'RUB') => {
  const safeValue = toSafeKopecks(valueKopecks);

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(safeValue / 100);
};

export const formatPriceNumber = (valueKopecks: number) => {
  const safeValue = toSafeKopecks(valueKopecks);
  return safeValue / 100;
};