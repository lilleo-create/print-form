import { Address } from '../types';

export function formatAddress(address: Address) {
  const label = address.label?.trim();
  if (label) return label;

  const text = address.addressText?.trim() ?? '';
  if (!text) return 'Адрес не указан';

  // коротко: "улица, дом" как fallback
  // очень простая версия: берем первую часть до запятой/вторую
  const parts = text.split(',').map(s => s.trim()).filter(Boolean);

  // попробуем взять что-то похожее на "улица ... дом ..."
  return parts.length >= 2 ? `${parts[1]}` : parts[0];
}
