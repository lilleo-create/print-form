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
  const kopecks =
    typeof value === 'number' && Number.isFinite(value) ? value : 0;
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
