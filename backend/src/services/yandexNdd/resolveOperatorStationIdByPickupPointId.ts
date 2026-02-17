import { yandexNddClient } from './YandexNddClient';
import { normalizeDigitsStation } from './getOperatorStationId';

export const resolveOperatorStationIdByPickupPointId = async (pickupPointId: string): Promise<string | null> => {
  const response = await yandexNddClient.pickupPointsList({ pickup_point_ids: [pickupPointId] });
  const firstPoint = Array.isArray(response?.points) ? response.points[0] : null;
  const operatorStationId = normalizeDigitsStation(firstPoint?.operator_station_id);

  console.info('[NDD][resolveOperatorStationId]', {
    pickupPointId,
    operatorStationIdFound: Boolean(operatorStationId)
  });

  return operatorStationId;
};
