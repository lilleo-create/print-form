import { resolvePvzIds } from './resolvePvzIds';

/**
 * @deprecated Use resolvePvzIds() instead. Kept for backward compatibility.
 * Returns platformStationId (UUID) and operatorStationId (digits); point is not returned.
 */
export const resolvePlatformStationIdByPickupPointId = async (pickupPointId: string) => {
  const { platformId, operatorStationId } = await resolvePvzIds(pickupPointId);
  return {
    platformStationId: platformId,
    operatorStationId,
    point: null
  };
};
