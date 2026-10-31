export const cdekReadbackLabel = (status?: string | null): string | null => {
  if (status === 'PENDING') return 'Заявка создана в CDEK, подтверждаем данные';
  if (status === 'AUTH_FAILED') return 'Заявка создана. Не удалось обновить данные доставки, статус уточняется.';
  return null;
};
