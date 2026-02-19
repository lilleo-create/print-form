export const formatReviewDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });


const DAY_IN_MS = 24 * 60 * 60 * 1000;

const startOfLocalDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const formatNearestDeliveryLabel = (deliveryDateEstimated?: string | Date | null, productionTimeHours?: number) => {
  const dateFromEstimate = deliveryDateEstimated ? new Date(deliveryDateEstimated) : null;
  const hasEstimate = Boolean(dateFromEstimate && !Number.isNaN(dateFromEstimate.getTime()));

  const targetDate = hasEstimate
    ? startOfLocalDay(dateFromEstimate as Date)
    : (() => {
        const baseHours = productionTimeHours ?? 24;
        const daysToAdd = Math.max(1, Math.ceil(baseHours / 24));
        const now = new Date();
        return startOfLocalDay(new Date(now.getTime() + daysToAdd * DAY_IN_MS));
      })();

  const today = startOfLocalDay(new Date());
  const differenceDays = Math.round((targetDate.getTime() - today.getTime()) / DAY_IN_MS);

  if (differenceDays <= 1) {
    return 'Завтра';
  }

  if (differenceDays === 2) {
    return 'Послезавтра';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long'
  }).format(targetDate);
};
