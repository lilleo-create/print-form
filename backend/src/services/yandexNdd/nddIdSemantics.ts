export class NddValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'NddValidationError';
    this.code = code;
  }
}

export const isDigits = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+$/.test(value.trim());

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );

export const looksLikeDigits = isDigits;

export const looksLikePvzId = (value: unknown): value is string =>
  isUuid(value);

export const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const assertPlatformStationId = (value: unknown, field: string): string => {
  const normalized = asTrimmedString(value);
  if (!normalized || !isUuid(normalized)) {
    throw new NddValidationError(
      'VALIDATION_ERROR',
      `${field} must be a platform station_id (uuid). Received: ${String(value ?? 'null')}`
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
