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

export const isDigits = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+$/.test(value.trim());

export const isDigitsStationId = isDigits;

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
  if (!normalized || !isDigits(normalized)) {
    throw new NddValidationError(
      'NDD_VALIDATION_ERROR',
      `${field} must be a platform station_id (digits).`,
      400,
      { field, expected: 'digits', received: value ?? null }
    );
  }
  return normalized;
};

export const assertPvzId = (value: unknown, field: string): string => {
  const normalized = asTrimmedString(value);
  if (!normalized || !looksLikePvzId(normalized)) {
    throw new NddValidationError('NDD_VALIDATION_ERROR', `${field} must be a pickup point id (uuid).`, 400, {
      field,
      expected: 'uuid',
      received: value ?? null
    });
  }
  return normalized;
};

export const assertStationAndPvzPair = (stationId: unknown, selfPickupId: unknown) => {
  const normalizedStationId = assertPlatformStationId(stationId, 'station_id');
  const normalizedSelfPickupId = assertPvzId(selfPickupId, 'self_pickup_id');

  if (normalizedStationId === normalizedSelfPickupId) {
    throw new NddValidationError(
      'NDD_VALIDATION_ERROR',
      'station_id and self_pickup_id must refer to different identifiers.',
      400,
      {
        station_id: normalizedStationId,
        self_pickup_id: normalizedSelfPickupId
      }
    );
  }

  return {
    stationId: normalizedStationId,
    selfPickupId: normalizedSelfPickupId
  };
};
