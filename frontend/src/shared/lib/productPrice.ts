const KOPECKS_IN_RUBLE = 100;

const toFiniteNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const kopecksToRubles = (value: unknown): number =>
  toFiniteNumber(value) / KOPECKS_IN_RUBLE;

export const rublesToKopecks = (value: unknown): number =>
  Math.round(toFiniteNumber(value) * KOPECKS_IN_RUBLE);
