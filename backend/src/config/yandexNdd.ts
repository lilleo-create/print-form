export type YandexNddConfig = {
  enabled: boolean;
  baseUrl: string;
  token?: string;
  lang: string;
  defaultStationId?: string; // ✅ digits
};

export const isYandexNddTestEnvironment = (baseUrl: string): boolean => {
  const normalized = baseUrl.toLowerCase();
  return normalized.includes('.tst.yandex.net');
};

const isDigits = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+$/.test(value.trim());

export const getYandexNddConfig = (): YandexNddConfig => {
  const defaultBaseUrl = 'https://b2b-authproxy.taxi.yandex.net';
  const rawBaseUrl = process.env.YANDEX_NDD_BASE_URL || defaultBaseUrl;
  const normalizedRawBaseUrl = rawBaseUrl.trim().replace(/\/+$/, '');
  const baseUrlWithoutApi = normalizedRawBaseUrl.replace(/\/api\/?$/, '');
  const shouldForceProdAuthProxy =
    process.env.NODE_ENV === 'production' && baseUrlWithoutApi.includes('b2b.taxi.yandex.net');
  const baseUrl = shouldForceProdAuthProxy ? defaultBaseUrl : baseUrlWithoutApi;

  if (shouldForceProdAuthProxy) {
    console.warn('[YANDEX_NDD] overriding deprecated production base URL', {
      providedBaseUrl: rawBaseUrl,
      forcedBaseUrl: defaultBaseUrl
    });
  }

  const token = process.env.YANDEX_NDD_TOKEN || '';
  const lang = process.env.YANDEX_NDD_LANG || 'ru';

  const rawDefaultStationId =
    process.env.YANDEX_NDD_MERCHANT_STATION_ID ||
    process.env.YANDEX_NDD_DEFAULT_STATION_ID ||
    process.env.YANDEX_NDD_STATION_ID;

  const defaultStationId = isDigits(rawDefaultStationId) ? rawDefaultStationId.trim() : null;

  if (rawDefaultStationId && !defaultStationId) {
    console.warn('[YANDEX_NDD] ignore invalid defaultStationId: value must be digits', {
      provided: rawDefaultStationId
    });
  }

  if (!token) {
    return { enabled: false, baseUrl, lang, defaultStationId: defaultStationId ?? undefined };
  }

  return { enabled: true, baseUrl, token, lang, defaultStationId: defaultStationId ?? undefined };
};