const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGITS_RE = /^\d{6,20}$/;

type StationIdParseOptions = {
  allowUuid?: boolean;
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

export const isValidStationId = (value: unknown, options: StationIdParseOptions = {}): boolean =>
  normalizeStationId(value, options) !== null;

export const getOperatorStationId = (metaRaw: unknown, options: StationIdParseOptions = {}): string | null => {
  const raw = asRecord(metaRaw);
  if (!raw) {
    return null;
  }

  const candidates: unknown[] = [
    raw.operator_station_id,
    raw.operatorStationId,
    raw.station_id,
    raw.stationId,
    raw.platform_station_id,
    raw.platformStationId,
    asRecord(raw.data)?.operator_station_id,
    asRecord(raw.data)?.station_id,
    asRecord(raw.data)?.platform_station_id,
    asRecord(raw.pickup_point)?.operator_station_id,
    asRecord(raw.pickup_point)?.station_id,
    asRecord(raw.pickup_point)?.platform_station_id,
    asRecord(raw.point)?.operator_station_id,
    asRecord(raw.point)?.station_id,
    asRecord(raw.point)?.platform_station_id
  ];

  for (const candidate of candidates) {
    const stationId = normalizeStationId(candidate, options);
    if (stationId) {
      return stationId;
    }
  }

  return null;
};
