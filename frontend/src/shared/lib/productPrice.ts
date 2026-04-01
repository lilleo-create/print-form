const KOPECKS_IN_RUBLE = 100;

const toFiniteNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const kopecksToRubles = (value: unknown): number =>
  toFiniteNumber(value) / KOPECKS_IN_RUBLE;

export const rublesToKopecks = (value: unknown): number =>
  Math.round(toFiniteNumber(value) * KOPECKS_IN_RUBLE);

export const normalizeRublesInput = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).replace(',', '.');
  }

  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(',', '.');
};

export const formatKopecksToRublesInput = (value: unknown): string => {
  const kopecks = toFiniteNumber(value);
  const rubles = kopecks / KOPECKS_IN_RUBLE;
  const normalized = rubles.toFixed(2);
  return normalized.endsWith('.00') ? normalized.slice(0, -3) : normalized;
};

export const parseRublesInputToKopecks = (value: unknown): number => {
  const normalized = normalizeRublesInput(value);
  if (!normalized) return 0;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;

  return Math.round(parsed * KOPECKS_IN_RUBLE);
};

export const formatPriceFromMinorUnits = (minorUnits: unknown): string =>
  formatKopecksToRublesInput(minorUnits);

export const parsePriceToMinorUnits = (input: unknown): number =>
  parseRublesInputToKopecks(input);

export const resolvePriceMinorUnits = (
  value: { price?: unknown; priceKopecks?: unknown; priceRubles?: unknown } | null | undefined
): number => {
  if (!value || typeof value !== 'object') return 0;

  if (typeof value.priceKopecks === 'number' && Number.isFinite(value.priceKopecks)) {
    return Math.round(value.priceKopecks);
  }

  if (typeof value.price === 'number' && Number.isFinite(value.price)) {
    return Math.round(value.price);
  }

  if (typeof value.priceRubles === 'number' && Number.isFinite(value.priceRubles)) {
    return Math.round(value.priceRubles * KOPECKS_IN_RUBLE);
  }

  return 0;
};
