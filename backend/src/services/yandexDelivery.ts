const DEFAULT_TEST_HOST = 'https://b2b.taxi.tst.yandex.net';
const DEFAULT_PROD_HOST = 'https://b2b-authproxy.taxi.yandex.net';
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

  if (!rawBody) return {} as T;
  return JSON.parse(rawBody) as T;
};

const toBounds = (lat: number, lng: number, km = 15) => {
  const latDelta = km / 111;
  const lngDelta = km / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    latitude: { from: lat - latDelta, to: lat + latDelta },
    longitude: { from: lng - lngDelta, to: lng + lngDelta }
  };
};

const pvzCache = new Map<string, PvzCacheEntry>();
const PVZ_CACHE_TTL_MS = 10 * 60_000;
const MOSCOW_RADIUS_KM = 15;

const createCityCacheKey = (city: string) => city.trim().toLowerCase();

const getCachedCityPvz = (key: string): NormalizedPvzPoint[] | null => {
  const cached = pvzCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    pvzCache.delete(key);
    return null;
  }
  return cached.points;
};

const setCachedCityPvz = (key: string, points: NormalizedPvzPoint[]) => {
  pvzCache.set(key, { points, expiresAt: Date.now() + PVZ_CACHE_TTL_MS });
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const toStringValue = (value: unknown) => (typeof value === 'string' ? value : null);

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const extractStationsFromPayload = (payload: unknown): JsonRecord[] => {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as JsonRecord;
  const result = record.result as JsonRecord | undefined;
  const data = record.data as JsonRecord | undefined;

  const candidates: unknown[] = [
    record.points,
    record.stations,
    record.pickup_points,
    record.platform_stations,
    result?.points,
    result?.stations,
    result?.pickup_points,
    result?.platform_stations,
    data?.points,
    data?.stations,
    data?.pickup_points,
    data?.platform_stations
  ];

  for (const candidate of candidates) {
    const rows = asArray(candidate).filter((row): row is JsonRecord => typeof row === 'object' && row !== null);
    if (rows.length > 0) return rows;
  }

  return [];
};

const normalizePaymentMethods = (station: JsonRecord): string[] => {
  const methods = asArray(station.payment_methods)
    .map((m) => toStringValue(m))
    .filter((m): m is string => Boolean(m));

  if (methods.length > 0) return methods;

  const payment = station.payment as JsonRecord | undefined;
  return asArray(payment?.methods)
    .map((m) => toStringValue(m))
    .filter((m): m is string => Boolean(m));
};

const normalizePvzPoint = (station: JsonRecord): NormalizedPvzPoint | null => {
  const position = (station.position as JsonRecord | undefined) ?? {};

  const lat =
    toNumber(position.lat) ??
    toNumber(position.latitude) ??
    toNumber(station.lat) ??
    toNumber(station.latitude);

  const lng =
    toNumber(position.lng) ??
    toNumber(position.lon) ??
    toNumber(position.longitude) ??
    toNumber(station.lng) ??
    toNumber(station.lon) ??
    toNumber(station.longitude);

  if (lat === null || lng === null) return null;

  const address = (station.address as JsonRecord | undefined) ?? {};
  const fullAddress =
    toStringValue(station.full_address) ??
    toStringValue(address.full_address) ??
    toStringValue(address.address) ??
    toStringValue(station.name) ??
    '';

  if (!fullAddress) return null;

  const id =
    toStringValue(station.id) ??
    toStringValue(station.station_id) ??
    toStringValue(station.platform_station_id) ??
    `${lat}:${lng}:${fullAddress}`;

  const platformStationId =
    toStringValue(station.platform_station_id) ??
    toStringValue(station.id) ??
    toStringValue(station.station_id) ??
    id;

  const type = toStringValue(station.type) ?? 'pickup_point';

  return {
    id,
    platformStationId,
    fullAddress,
    type,
    paymentMethods: normalizePaymentMethods(station),
    position: { lat, lng }
  };
};

const filterByQuery = (points: NormalizedPvzPoint[], query?: string) => {
  if (!query) return points;
  const lowered = query.trim().toLowerCase();
  if (!lowered) return points;
  return points.filter((p) => p.fullAddress.toLowerCase().includes(lowered));
};

const listStationsFromB2b = async (city: string): Promise<JsonRecord[]> => {
  const bounds = toBounds(MOSCOW_CENTER.lat, MOSCOW_CENTER.lng, MOSCOW_RADIUS_KM);

  // ВАЖНО: endpoint оставляем как в твоём коде
  // Если у Яндекса другой контракт — адаптируем payload, но path не меняем без нужды.
  const payload: JsonRecord = {
    city,
    bounds,
    type: 'pickup_point',
    only_available_for_in_day_delivery: false
  };

  const response = await requestYandex<JsonRecord>('/api/b2b/platform/stations/list', {
    method: 'POST',
    payload
  });

  return extractStationsFromPayload(response);
};

const getPvzPointsFromB2b = async (city: string) => {
  const stations = await listStationsFromB2b(city);
  return stations
    .map((s) => normalizePvzPoint(s))
    .filter((p): p is NormalizedPvzPoint => p !== null);
};

const canUseDevFallback = () => process.env.NODE_ENV !== 'production';

// DEV только, чтобы UI не умер в ноль, если B2B не отвечает или прав нет.
// В PROD возвращаем ошибку.
const devFallbackPoints: NormalizedPvzPoint[] = [
  {
    id: 'dev-pvz-лесная-5',
    platformStationId: 'dev-pvz-лесная-5',
    fullAddress: 'Москва, Лесная улица, 5',
    type: 'pickup_point',
    paymentMethods: ['already_paid'],
    position: { lat: 55.77841, lng: 37.58931 }
  }
];

export const fetchYandexPvz = async (params: { city: string; query?: string }) => {
  const cacheKey = createCityCacheKey(params.city);
  const cached = getCachedCityPvz(cacheKey);
  if (cached) return filterByQuery(cached, params.query);

  try {
    const points = await getPvzPointsFromB2b(params.city);

    if (points.length > 0) {
      setCachedCityPvz(cacheKey, points);
      return filterByQuery(points, params.query);
    }

    if (canUseDevFallback()) return filterByQuery(devFallbackPoints, params.query);

    throw new Error('PVZ unavailable via B2B API. Check token/permissions and endpoint /api/b2b/platform/stations/list.');
  } catch (e) {
    if (canUseDevFallback()) return filterByQuery(devFallbackPoints, params.query);
    throw e;
  }
};
