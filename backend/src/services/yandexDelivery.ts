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
  fullAddress: string;
  position: { lat: number; lng: number };
  type?: string;
  paymentMethods?: string[];
  platformStationId?: string;
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
    '';

  if (!id || !fullAddress) {
    return null;
  }

  const paymentMethods = asArray(station.payment_methods)
    .map((method) => (typeof method === 'string' ? method : null))
    .filter((method): method is string => Boolean(method));

  const type = typeof station.type === 'string' ? station.type : undefined;
  const platformStationId =
    (station.platform_station_id as string | undefined) ??
    (station.id as string | undefined) ??
    undefined;

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

const fallbackStations: NormalizedPvzPoint[] = [
  {
    id: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924',
    platformStationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924',
    fullAddress: 'Москва, 1-я Тверская-Ямская улица, 2с1',
    position: { lat: 55.77372, lng: 37.59296 },
    type: 'pickup_point',
    paymentMethods: ['already_paid']
  },
  {
    id: '2f4f4b3a-52fe-4f4f-9d9a-6b2d0f85aa27',
    platformStationId: '2f4f4b3a-52fe-4f4f-9d9a-6b2d0f85aa27',
    fullAddress: 'Москва, Лесная улица, 5',
    position: { lat: 55.77841, lng: 37.58931 },
    type: 'pickup_point',
    paymentMethods: ['already_paid']
  }
];

export const fetchYandexPvz = async (params: { city: string; query?: string }) => {
  const bounds = toBounds(MOSCOW_CENTER.lat, MOSCOW_CENTER.lng, 35);
  const apiRequests: Array<{ path: string; payload: JsonRecord }> = [
    {
      path: '/api/b2b/platform/stations/list',
      payload: {
        city: params.city,
        query: params.query,
        type: 'pickup_point',
        bounds,
        only_available_for_in_day_delivery: false
      }
    },
    {
      path: '/api/b2b/platform/stations/search',
      payload: {
        city: params.city,
        query: params.query,
        bounds,
        limit: 200
      }
    }
  ];

  const errors: string[] = [];

  for (const requestConfig of apiRequests) {
    try {
      const response = await requestYandex<JsonRecord>(requestConfig.path, {
        method: 'POST',
        payload: requestConfig.payload
      });
      const stations = tryGetStationArray(response);
      const normalized = stations
        .map((station) => normalizePvzPoint(station))
        .filter((point): point is NormalizedPvzPoint => point !== null);

      if (normalized.length > 0) {
        return filterByQuery(normalized, params.query);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown yandex error');
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn('[YANDEX_DELIVERY] API list fallback enabled', { errorsCount: errors.length, errors });
  }

  return filterByQuery(fallbackStations, params.query);
};
