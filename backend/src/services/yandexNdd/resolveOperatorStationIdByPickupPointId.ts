import { yandexNddClient } from './YandexNddClient';
import { normalizeDigitsStation } from './getOperatorStationId';

export const resolveOperatorStationIdByPickupPointId = async (pickupPointId: string): Promise<string | null> => {
  const response = await yandexNddClient.pickupPointsList({ pickup_point_ids: [pickupPointId] });
  const points = Array.isArray(response?.points) ? response.points : [];
  const point = points.find((item) => item && typeof item === 'object' && (item as { id?: unknown }).id === pickupPointId) ?? null;
  const operatorStationId = normalizeDigitsStation((point as { operator_station_id?: unknown } | null)?.operator_station_id);

  console.info('[NDD][resolveOperatorStationId]', {
    pickupPointId,
    operatorStationId,
    available_for_dropoff: (point as { available_for_dropoff?: unknown } | null)?.available_for_dropoff ?? null,
    type: (point as { type?: unknown } | null)?.type ?? null
  });

  return operatorStationId;
};
