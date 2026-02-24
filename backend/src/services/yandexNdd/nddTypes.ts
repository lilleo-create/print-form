/**
 * Types for Yandex NDD B2B API (pickup-points/list, offers/create, etc.)
 * Without merchant API; platform_id = UUID (PVZ pickup_point_id), operator_station_id = digits.
 */

/** One point from POST /api/b2b/platform/pickup-points/list */
export type PickupPointListItem = {
  /** UUID — pickup_point_id (use as platform_station.platform_id) */
  id: string;
  /** Digits — operator station id */
  operator_station_id?: string;
  platform_station_id?: string;
  station_id?: string;
  [key: string]: unknown;
};

export type PickupPointsListResponse = {
  points?: PickupPointListItem[];
  result?: { points?: PickupPointListItem[] };
};

/** Result of resolving one PVZ via pickup-points/list */
export type ResolvedPvzIds = {
  /** UUID, length 36 with dashes — for platform_station.platform_id */
  platformId: string;
  /** Digits only — operator_station_id (optional for some flows) */
  operatorStationId: string | null;
};

/** Offer item from offers/create response */
export type NddOfferItem = {
  offer_id: string;
  [key: string]: unknown;
};

export type OffersCreateResponse = {
  offers?: NddOfferItem[];
  [key: string]: unknown;
};

export type OffersConfirmResponse = {
  request_id?: string;
  status?: string;
  [key: string]: unknown;
};

export type RequestInfoResponse = {
  request_id?: string;
  status?: string;
  sharing_url?: string;
  request?: { request_id?: string; status?: string; sharing_url?: string };
  [key: string]: unknown;
};
