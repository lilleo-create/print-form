const DAY_IN_MS = 24 * 60 * 60 * 1000;

const startOfLocalDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const formatDeliveryDate = (date: string | Date | null | undefined): string | null => {
  if (!date) return null;

  const deliveryDate = date instanceof Date ? new Date(date) : new Date(date);
  if (Number.isNaN(deliveryDate.getTime())) {
    return null;
  }

  const today = startOfLocalDay(new Date());
  const deliveryDay = startOfLocalDay(deliveryDate);
  const differenceDays = Math.round((deliveryDay.getTime() - today.getTime()) / DAY_IN_MS);

  if (differenceDays <= 0) {
    return 'сегодня';
  }

  if (differenceDays === 1) {
    return 'завтра';
  }

  if (differenceDays === 2) {
    return 'послезавтра';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long'
  }).format(deliveryDay);
};
