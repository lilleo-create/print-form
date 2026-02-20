import { yandexNddClient } from './YandexNddClient';
import { asTrimmedString, isDigits } from './nddIdSemantics';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const readOperatorStationId = (point: Record<string, unknown> | null): string | null => {
  const normalized = asTrimmedString((point as any)?.operator_station_id);
  return normalized && isDigits(normalized) ? normalized : null;
};

export const resolvePlatformStationIdByPickupPointId = async (pickupPointId: string) => {
  const response = await yandexNddClient.pickupPointsList({ pickup_point_ids: [pickupPointId] });

  const points = Array.isArray((response as any)?.points)
    ? ((response as any).points as any[])
    : Array.isArray((response as any)?.result?.points)
      ? ((response as any).result.points as any[])
      : [];

  const point =
    points.find((item) => item && typeof item === 'object' && String((item as any).id ?? '') === pickupPointId) ?? null;

  const pointRecord = asRecord(point);
  const operatorStationId = readOperatorStationId(pointRecord);

  console.info('[NDD][resolveOperatorStationId]', {
    pickupPointId,
    operatorStationId,
    shapes: { operatorStationId: operatorStationId ? 'digits' : 'missing' }
  });

  return {
    platformStationId: null, // намеренно: не используем UUID "platform station" в старом offers/create
    operatorStationId,
    point: pointRecord
  };
};