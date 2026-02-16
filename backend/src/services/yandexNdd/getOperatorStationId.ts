const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const DIGITS_ONLY = /^\d+$/;

const toStationId = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const asString = String(value);
    return DIGITS_ONLY.test(asString) ? asString : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !DIGITS_ONLY.test(trimmed)) {
    return null;
  }

  return trimmed;
};

export const getOperatorStationId = (metaRaw: unknown): string | null => {
  const raw = asRecord(metaRaw);
  if (!raw) {
    return null;
  }

  const candidates: unknown[] = [
    raw.operator_station_id,
    raw.operatorStationId,
    raw.station_id,
    raw.stationId,
    asRecord(raw.data)?.operator_station_id,
    asRecord(raw.pickup_point)?.operator_station_id,
    asRecord(raw.point)?.operator_station_id
  ];

  for (const candidate of candidates) {
    const stationId = toStationId(candidate);
    if (stationId) {
      return stationId;
    }
  }

  return null;
};
