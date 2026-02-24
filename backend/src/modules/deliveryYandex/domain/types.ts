/**
 * Branded types for Yandex NDD identifiers. Do not mix: use the correct type at each boundary.
 */

/** UUID, e.g. 00030747-d3c5-44a4-8730-49727c54367a (pickup point id from API) */
export type PickupPointId = string & { readonly __brand: 'PickupPointId' };

/** Digits only, e.g. 10031634211 (operator_station_id in point data) */
export type OperatorStationId = string & { readonly __brand: 'OperatorStationId' };

/** Digits only, e.g. 10022023854 — used as station_id in offers/request API when required */
export type PlatformStationId = string & { readonly __brand: 'PlatformStationId' };

export type CorrelationId = string & { readonly __brand: 'CorrelationId' };

/** Normalized pickup point for our API responses */
export type NormalizedPickupPoint = {
  pickupPointId: PickupPointId;
  name: string;
  address?: string;
  /** If API returns digits station_id for offers/requests */
  platformStationId?: PlatformStationId | null;
  /** If API returns operator_station_id in point */
  operatorStationId?: OperatorStationId | null;
  operatorId?: string | null;
  /** Optional for UI (map, etc.) */
  latitude?: number | null;
  longitude?: number | null;
};
