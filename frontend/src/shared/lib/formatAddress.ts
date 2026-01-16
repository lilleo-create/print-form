import { Address } from '../types';

export const formatAddress = (address?: Address | null) => {
  if (!address) {
    return '';
  }
  const parts = [`${address.city}`, `${address.street} ${address.house}`];
  if (address.apt) {
    parts.push(`кв. ${address.apt}`);
  }
  return parts.filter(Boolean).join(', ');
};
