export class NddValidationError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'NddValidationError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const looksLikeDigits = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+$/.test(value.trim());

export const looksLikeUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());

export const looksLikePvzId = looksLikeUuid;

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
      'NDD_VALIDATION_ERROR',
      `${field} must be a platform station_id (digits). Received: ${String(value ?? 'null')}`
    );
  }
  return normalized;
};

export const assertPvzId = (value: unknown, field: string): string => {
  const normalized = asTrimmedString(value);
  if (!normalized || !looksLikePvzId(normalized)) {
    throw new NddValidationError('NDD_VALIDATION_ERROR', `${field} must be a pickup point id UUID (self_pickup_id).`);
  }
  return normalized;
};
