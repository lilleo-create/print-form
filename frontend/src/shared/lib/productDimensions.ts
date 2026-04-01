const CM_IN_MM = 10;

const toFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export const cmToMm = (value: unknown): number | undefined => {
  const cm = toFiniteNumber(value);
  if (cm === null) return undefined;
  return Math.round(cm * CM_IN_MM);
};

export const mmToCm = (value: unknown): number | undefined => {
  const mm = toFiniteNumber(value);
  if (mm === null) return undefined;
  return mm / CM_IN_MM;
};
