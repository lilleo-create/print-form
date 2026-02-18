const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGITS_RE = /^\d{6,20}$/;

type StationIdParseOptions = {
  allowUuid?: boolean;
};

export const isDigitsStationId = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  return /^\d+$/.test(value.trim());
};

export const normalizeStationId = (value: unknown, options: StationIdParseOptions = {}): string | null => {
  const allowUuid = options.allowUuid ?? true;
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!DIGITS_RE.test(trimmed) && !(allowUuid && UUID_RE.test(trimmed))) {
    return null;
  }

  return trimmed;
};

export const normalizeDigitsStation = (value: unknown): string | null => {
  if (!isDigitsStationId(value)) {
    return null;
  }

  return value.trim();
};

export const toStationId = (value: unknown): string | null => normalizeDigitsStation(value);

export const isValidStationId = (value: unknown, options: StationIdParseOptions = {}): boolean =>
  normalizeStationId(value, options) !== null;

export const getOperatorStationId = (metaRaw: unknown, _options: StationIdParseOptions = {}): string | null => {
  const raw = asRecord(metaRaw);
  if (!raw) {
    return null;
  }

  const data = asRecord(raw.data);
  const pickupPoint = asRecord(raw.pickup_point);
  const point = asRecord(raw.point);

  const candidates: unknown[] = [
    raw.operator_station_id,
    raw.operatorStationId,
    data?.operator_station_id,
    data?.operatorStationId,
    pickupPoint?.operator_station_id,
    pickupPoint?.operatorStationId,
    point?.operator_station_id,
    point?.operatorStationId
  ];

  for (const candidate of candidates) {
    const stationId = toStationId(candidate);
    if (stationId) {
      return stationId;
    }
  }

  return null;
};
