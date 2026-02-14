const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

export const getOperatorStationId = (metaRaw: unknown): string | null => {
  const raw = asRecord(metaRaw);
  if (!raw) {
    return null;
  }

  const directValue = raw.operator_station_id;
  if (typeof directValue === 'string' && directValue.trim()) {
    return directValue.trim();
  }

  if (typeof directValue === 'number' && Number.isFinite(directValue)) {
    return String(directValue);
  }

  return null;
};

