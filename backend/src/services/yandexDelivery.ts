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

  if (!rawBody) {
    return {} as T;
  }

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

const asArray = (value: unknown): unknown[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
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

const toStringValue = (value: unknown) => (typeof value === 'string' ? value : null);

const extractStationsFromPayload = (payload: unknown): JsonRecord[] => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

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
    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
};

const normalizePaymentMethods = (station: JsonRecord): string[] => {
  const methods = asArray(station.payment_methods)
    .map((method) => toStringValue(method))
    .filter((method): method is string => Boolean(method));

  if (methods.length > 0) {
    return methods;
  }

  const payment = station.payment as JsonRecord | undefined;
  return asArray(payment?.methods)
    .map((method) => toStringValue(method))
    .filter((method): method is string => Boolean(method));
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
    toStringValue(station.full_address) ??
    toStringValue(addressRecord.full_address) ??
    toStringValue(addressRecord.address) ??
    toStringValue(station.name) ??
    '';

  if (!fullAddress) {
    return null;
  }

  const id =
    toStringValue(station.id) ??
    toStringValue(station.station_id) ??
    toStringValue(station.platform_station_id) ??
    `${latitude}:${longitude}:${fullAddress}`;

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
    position: { lat: latitude, lng: longitude }
  };
};

const filterByQuery = (points: NormalizedPvzPoint[], query?: string) => {
  if (!query) return points;
  const lowered = query.trim().toLowerCase();
  if (!lowered) return points;
  return points.filter((point) => point.fullAddress.toLowerCase().includes(lowered));
};

const pvzCache = new Map<string, PvzCacheEntry>();
const PVZ_CACHE_TTL_MS = 10 * 60_000;
const MOSCOW_RADIUS_KM = 15;

const createCityCacheKey = (city: string) => city.trim().toLowerCase();

const getCachedCityPvz = (key: string): NormalizedPvzPoint[] | null => {
  const cached = pvzCache.get(key);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAt) {
    pvzCache.delete(key);
    return null;
  }

  return cached.points;
};

const setCachedCityPvz = (key: string, points: NormalizedPvzPoint[]) => {
  pvzCache.set(key, {
    points,
    expiresAt: Date.now() + PVZ_CACHE_TTL_MS
  });
};

const devFallbackPoints: NormalizedPvzPoint[] = [
  {
    id: 'dev-pvz-1',
    platformStationId: 'dev-pvz-1',
    fullAddress: 'Москва, Лесная улица, 5',
    type: 'pickup_point',
    paymentMethods: ['already_paid'],
    position: { lat: 55.77841, lng: 37.58931 }
  },
  {
    id: 'dev-pvz-2',
    platformStationId: 'dev-pvz-2',
    fullAddress: 'Москва, 1-я Тверская-Ямская улица, 2с1',
    type: 'pickup_point',
    paymentMethods: ['already_paid'],
    position: { lat: 55.77372, lng: 37.59296 }
  },
  {
    id: 'dev-pvz-3',
    platformStationId: 'dev-pvz-3',
    fullAddress: 'Москва, Новослободская улица, 4',
    type: 'pickup_point',
    paymentMethods: ['already_paid'],
    position: { lat: 55.78173, lng: 37.5986 }
  }
];

const listStationsFromB2b = async (city: string): Promise<JsonRecord[]> => {
  const bounds = toBounds(MOSCOW_CENTER.lat, MOSCOW_CENTER.lng, MOSCOW_RADIUS_KM);
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
    .map((station) => normalizePvzPoint(station))
    .filter((point): point is NormalizedPvzPoint => point !== null);
};

const canUseDevFallback = () => process.env.NODE_ENV !== 'production';

export const fetchYandexPvz = async (params: { city: string; query?: string }) => {
  const cacheKey = createCityCacheKey(params.city);
  const cachedCityPoints = getCachedCityPvz(cacheKey);
  if (cachedCityPoints) {
    return filterByQuery(cachedCityPoints, params.query);
  }

  try {
    const points = await getPvzPointsFromB2b(params.city);
    if (points.length > 0) {
      setCachedCityPvz(cacheKey, points);
      return filterByQuery(points, params.query);
    }

    if (canUseDevFallback()) {
      return filterByQuery(devFallbackPoints, params.query);
    }

    throw new Error('PVZ unavailable, check integration');
  } catch {
    if (canUseDevFallback()) {
      return filterByQuery(devFallbackPoints, params.query);
    }

    throw new Error('PVZ unavailable, check integration');
  }
};
