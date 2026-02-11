const DEFAULT_TEST_HOST = 'https://b2b.taxi.tst.yandex.net';
const DEFAULT_PROD_HOST = 'https://b2b.taxi.yandex.net';
const MOSCOW_CENTER = { lat: 55.7558, lng: 37.6176 };

type JsonRecord = Record<string, unknown>;

type RequestYandexOptions = {
  method?: 'GET' | 'POST';
  payload?: JsonRecord;
};

export type NormalizedPvzPoint = {
  id: string;
  platformStationId: string;
  fullAddress: string;
  type: string;
  paymentMethods: string[];
  position: { lat: number; lng: number };
};

type YandexWidgetPoint = JsonRecord;

type YandexWidgetResponse = {
  data?: {
    points?: YandexWidgetPoint[];
  };
};

type PvzCacheEntry = {
  expiresAt: number;
  points: NormalizedPvzPoint[];
};

const readRequired = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`[YANDEX_DELIVERY] Missing required env: ${key}`);
  }
  return value;
};

const getYandexDeliveryConfig = () => {
  const mode = (process.env.YANDEX_DELIVERY_MODE ?? 'TEST').trim().toUpperCase();
  const token = readRequired('YANDEX_DELIVERY_TOKEN');
  const hostFromEnv = process.env.YANDEX_DELIVERY_HOST?.trim();

  const host = (hostFromEnv || (mode === 'PROD' ? DEFAULT_PROD_HOST : DEFAULT_TEST_HOST)).replace(/\/$/, '');

  return { mode, token, host };
};

export const requestYandex = async <T>(path: string, options: RequestYandexOptions = {}) => {
  const config = getYandexDeliveryConfig();
  const method = options.method ?? 'POST';
  const url = `${config.host}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: method === 'GET' ? undefined : JSON.stringify(options.payload ?? {})
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(`[YANDEX_DELIVERY] ${method} ${path} failed with ${response.status}: ${rawBody}`);
  }

  if (!rawBody) {
    return {} as T;
  }

  return JSON.parse(rawBody) as T;
};

const toBounds = (lat: number, lng: number, km = 25) => {
  const latDelta = km / 111;
  const lngDelta = km / (111 * Math.cos((lat * Math.PI) / 180));

  return {
    latitude: { from: lat - latDelta, to: lat + latDelta },
    longitude: { from: lng - lngDelta, to: lng + lngDelta }
  };
};

const widgetPvzCache = new Map<string, PvzCacheEntry>();
const PVZ_CACHE_TTL_MS = 60_000;
const MOSCOW_RADIUS_KM = 15;
const WIDGET_PVZ_URL = 'https://widget-pvz.dostavka.yandex.net/list';

const createPvzCacheKey = (city: string, query?: string) => `${city}:${query ?? ''}`;

const getCachedPvz = (key: string): NormalizedPvzPoint[] | null => {
  const cached = widgetPvzCache.get(key);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAt) {
    widgetPvzCache.delete(key);
    return null;
  }

  return cached.points;
};

const setCachedPvz = (key: string, points: NormalizedPvzPoint[]) => {
  widgetPvzCache.set(key, {
    points,
    expiresAt: Date.now() + PVZ_CACHE_TTL_MS
  });
};

const asArray = (value: unknown): unknown[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
};

const tryGetStationArray = (payload: unknown): JsonRecord[] => {
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as JsonRecord;
  const candidates = [
    record.points,
    record.stations,
    record.pickup_points,
    record.platform_stations,
    (record.result as JsonRecord | undefined)?.points,
    (record.result as JsonRecord | undefined)?.stations,
    (record.data as JsonRecord | undefined)?.points,
    (record.data as JsonRecord | undefined)?.stations
  ];

  for (const candidate of candidates) {
    const rows = asArray(candidate).filter((row): row is JsonRecord => typeof row === 'object' && row !== null);
    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizePvzPoint = (station: JsonRecord): NormalizedPvzPoint | null => {
  const position = (station.position as JsonRecord | undefined) ?? {};
  const latitude =
    toNumber(position.lat) ??
    toNumber(position.latitude) ??
    toNumber(station.lat) ??
    toNumber(station.latitude);
  const longitude =
    toNumber(position.lng) ??
    toNumber(position.lon) ??
    toNumber(position.longitude) ??
    toNumber(station.lng) ??
    toNumber(station.lon) ??
    toNumber(station.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  const addressRecord = (station.address as JsonRecord | undefined) ?? {};
  const fullAddress =
    (station.full_address as string | undefined) ??
    (addressRecord.full_address as string | undefined) ??
    (addressRecord.address as string | undefined) ??
    (station.name as string | undefined) ??
    '';

  const id =
    (station.id as string | undefined) ??
    (station.station_id as string | undefined) ??
    (station.platform_station_id as string | undefined) ??
    `${latitude}:${longitude}:${fullAddress}`;

  if (!fullAddress) {
    return null;
  }

  const paymentMethods = asArray(station.payment_methods)
    .map((method) => (typeof method === 'string' ? method : null))
    .filter((method): method is string => Boolean(method));

  const type = typeof station.type === 'string' ? station.type : '';
  const platformStationId =
    (station.platform_station_id as string | undefined) ??
    (station.id as string | undefined) ??
    (station.station_id as string | undefined) ??
    id;

  return {
    id,
    fullAddress,
    position: { lat: latitude, lng: longitude },
    type,
    paymentMethods,
    platformStationId
  };
};

const filterByQuery = (points: NormalizedPvzPoint[], query?: string) => {
  if (!query) return points;
  const lowered = query.trim().toLowerCase();
  if (!lowered) return points;
  return points.filter((point) => point.fullAddress.toLowerCase().includes(lowered));
};

const fetchWidgetPvzPoints = async (bounds: { latitude: { from: number; to: number }; longitude: { from: number; to: number } }) => {
  const response = await fetch(WIDGET_PVZ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      is_post_office: false,
      latitude: bounds.latitude,
      longitude: bounds.longitude
    })
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(`[YANDEX_WIDGET_PVZ] Failed with status ${response.status}: ${rawBody}`);
  }

  if (!rawBody) {
    return [] as YandexWidgetPoint[];
  }

  const payload = JSON.parse(rawBody) as YandexWidgetResponse;
  if (!Array.isArray(payload.data?.points)) {
    return [];
  }

  return payload.data.points.filter((point): point is YandexWidgetPoint => typeof point === 'object' && point !== null);
};

export const fetchYandexPvz = async (params: { city: string; query?: string }) => {
  const cacheKey = createPvzCacheKey(params.city, params.query);
  const cachedPoints = getCachedPvz(cacheKey);
  if (cachedPoints) {
    return cachedPoints;
  }

  const bounds = toBounds(MOSCOW_CENTER.lat, MOSCOW_CENTER.lng, MOSCOW_RADIUS_KM);
  const points = await fetchWidgetPvzPoints(bounds);
  const normalizedPoints = points
    .map((point) => normalizePvzPoint(point))
    .filter((point): point is NormalizedPvzPoint => point !== null);
  const filteredPoints = filterByQuery(normalizedPoints, params.query);

  setCachedPvz(cacheKey, filteredPoints);

  return filteredPoints;
};
