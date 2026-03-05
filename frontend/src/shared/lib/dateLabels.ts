const DAY_IN_MS = 24 * 60 * 60 * 1000;

const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const parseDateSafe = (value?: string | Date | null): Date | null => {
  if (!value) return null;

  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatRelativeRuDate = (date: Date): string => {
  const targetDay = startOfLocalDay(date);
  const today = startOfLocalDay(new Date());
  const diffDays = Math.round(
    (targetDay.getTime() - today.getTime()) / DAY_IN_MS
  );

  if (diffDays === 0) return 'сегодня';
  if (diffDays === 1) return 'завтра';
  if (diffDays === 2) return 'послезавтра';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long'
  }).format(targetDay);
};

export const formatReadyToShipLabel = (
  productionTimeHours?: number
): string => {
  const readyAt = new Date(
    Date.now() + (productionTimeHours ?? 24) * 60 * 60 * 1000
  );
  return formatRelativeRuDate(readyAt);
};

export const formatCarrierDeliveryLabel = (
  estimatedDate?: string | Date | null,
  etaDays?: number | null
): string => {
  const parsedEstimatedDate = parseDateSafe(estimatedDate);
  if (parsedEstimatedDate) {
    return formatRelativeRuDate(parsedEstimatedDate);
  }

  if (typeof etaDays === 'number') {
    const estimatedFromEta = new Date(Date.now() + etaDays * DAY_IN_MS);
    return formatRelativeRuDate(estimatedFromEta);
  }

  return 'уточняется при оформлении';
};
