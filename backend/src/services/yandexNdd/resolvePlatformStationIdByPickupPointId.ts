import { yandexNddClient } from './YandexNddClient';
import { asTrimmedString, looksLikeDigits } from './nddIdSemantics';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const readPlatformStationId = (point: Record<string, unknown> | null): string | null => {
  if (!point) {
    return null;
  }

  const station = asRecord(point.station);
  const candidates: unknown[] = [
    point.station_id,
    point.platform_station_id,
    station?.id,
    station?.station_id,
    station?.platform_station_id
  ];

  for (const candidate of candidates) {
    const normalized = asTrimmedString(candidate);
    if (normalized && looksLikeDigits(normalized)) {
      return normalized;
    }
  }

  return null;
};

const readOperatorStationId = (point: Record<string, unknown> | null): string | null => {
  const normalized = asTrimmedString(point?.operator_station_id);
  return normalized && looksLikeDigits(normalized) ? normalized : null;
};

export const resolvePlatformStationIdByPickupPointId = async (pickupPointId: string) => {
  const response = await yandexNddClient.pickupPointsList({ pickup_point_ids: [pickupPointId] });
  const points = Array.isArray(response?.points) ? response.points : [];
  const point =
    points.find((item) => item && typeof item === 'object' && (item as { id?: unknown }).id === pickupPointId) ?? null;

  const pointRecord = asRecord(point);
  const platformStationId = readPlatformStationId(pointRecord);
  const operatorStationId = readOperatorStationId(pointRecord);

  console.info('[NDD][resolvePlatformStationId]', {
    pickupPointId,
    platformStationId,
    operatorStationId,
    source_fields: ['point.station_id', 'point.platform_station_id', 'point.station.id', 'point.station.station_id'],
    shapes: {
      platformStationId: platformStationId ? 'digits' : 'missing',
      operatorStationId: operatorStationId ? 'digits' : 'missing'
    }
  });

  return {
    platformStationId,
    operatorStationId,
    point: pointRecord
  };
};
