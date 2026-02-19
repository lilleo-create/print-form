export class NddValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'NddValidationError';
    this.code = code;
  }
}

export const looksLikeDigits = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+$/.test(value.trim());

export const looksLikePvzId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9-]{16,64}$/i.test(value.trim()) && !looksLikeDigits(value);

export const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const assertPlatformStationId = (value: unknown, field: string): string => {
  const normalized = asTrimmedString(value);
  if (!normalized || !looksLikeDigits(normalized)) {
    throw new NddValidationError(
      'VALIDATION_ERROR',
      `${field} must be a platform station_id (digits). Received: ${String(value ?? 'null')}`
    );
  }
  return normalized;
};

export const assertPvzId = (value: unknown, field: string): string => {
  const normalized = asTrimmedString(value);
  if (!normalized || !looksLikePvzId(normalized)) {
    throw new NddValidationError('VALIDATION_ERROR', `${field} must be a pickup point id (pvzId).`);
  }
  return normalized;
};
