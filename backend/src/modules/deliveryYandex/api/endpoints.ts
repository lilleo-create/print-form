/**
 * Yandex B2B platform API paths. Only methods from the allowed list.
 */

export const ENDPOINTS = {
  LOCATION_DETECT: '/api/b2b/platform/location/detect',
  PICKUP_POINTS_LIST: '/api/b2b/platform/pickup-points/list',
  OFFERS_INFO: '/api/b2b/platform/offers/info',
  OFFERS_CREATE: '/api/b2b/platform/offers/create',
  OFFERS_CONFIRM: '/api/b2b/platform/offers/confirm',
  REQUEST_CREATE: '/api/b2b/platform/request/create',
  REQUEST_INFO: '/api/b2b/platform/request/info',
  REQUEST_ACTUAL_INFO: '/api/b2b/platform/request/actual_info',
  REQUEST_HISTORY: '/api/b2b/platform/request/history',
  REQUEST_CANCEL: '/api/b2b/platform/request/cancel',
  REQUEST_GENERATE_LABELS: '/api/b2b/platform/request/generate-labels',
  REQUEST_GET_HANDOVER_ACT: '/api/b2b/platform/request/get-handover-act',
} as const;
