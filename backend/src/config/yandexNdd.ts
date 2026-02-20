export type YandexNddConfig = {
  enabled: boolean;
  baseUrl: string;
  token?: string;
  lang: string;
  defaultPlatformStationId?: string;
};

export const isYandexNddTestEnvironment = (baseUrl: string): boolean => {
  const normalized = baseUrl.toLowerCase();
  return normalized.includes('.tst.yandex.net');
};

const isDigits = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+$/.test(value.trim());

export const getYandexNddConfig = (): YandexNddConfig => {
  const defaultBaseUrl = 'https://b2b.taxi.tst.yandex.net';
  const rawBaseUrl = process.env.YANDEX_NDD_BASE_URL || defaultBaseUrl;
  const baseUrl = rawBaseUrl.trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');

  const token = process.env.YANDEX_NDD_TOKEN || '';
  const lang = process.env.YANDEX_NDD_LANG || 'ru';

  const rawDefaultStationId =
    process.env.YANDEX_NDD_MERCHANT_STATION_ID ||
    process.env.YANDEX_NDD_DEFAULT_STATION_ID ||
    process.env.YANDEX_NDD_STATION_ID;

  const defaultPlatformStationId = isDigits(rawDefaultStationId) ? rawDefaultStationId.trim() : null;

  if (rawDefaultStationId && !defaultPlatformStationId) {
    console.warn('[YANDEX_NDD] ignore invalid defaultStationId: value must be digits', {
      provided: rawDefaultStationId
    });
  }

  if (!token) {
    return { enabled: false, baseUrl, lang, defaultPlatformStationId: defaultPlatformStationId ?? undefined };
  }

  return { enabled: true, baseUrl, token, lang, defaultPlatformStationId: defaultPlatformStationId ?? undefined };
};
