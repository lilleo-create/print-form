export type YandexNddConfig = {
  enabled: boolean;
  baseUrl: string;
  token?: string;
  lang: string;
  defaultPlatformStationId?: string; // UUID (platform_station_id / platform_id)
};

export const isYandexNddTestEnvironment = (baseUrl: string): boolean => {
  const normalized = baseUrl.toLowerCase();
  return normalized.includes('.tst.yandex.net');
};

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

export const getYandexNddConfig = (): YandexNddConfig => {
  const defaultBaseUrl = 'https://b2b.taxi.tst.yandex.net';
  const rawBaseUrl = process.env.YANDEX_NDD_BASE_URL || defaultBaseUrl;
  const baseUrl = rawBaseUrl.trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');

  const token = (process.env.YANDEX_NDD_TOKEN || '').trim();
  const lang = (process.env.YANDEX_NDD_LANG || 'ru').trim();

  // Раньше ты пытался засунуть сюда digits. Теперь это UUID (platform station id).
  const rawDefaultStationId =
    process.env.YANDEX_NDD_DEFAULT_PLATFORM_STATION_ID ||
    process.env.YANDEX_NDD_DEFAULT_STATION_ID ||
    process.env.YANDEX_NDD_STATION_ID ||
    '';

  const defaultPlatformStationId = isUuid(rawDefaultStationId) ? rawDefaultStationId.trim() : undefined;

  if (rawDefaultStationId && !defaultPlatformStationId) {
    console.warn('[YANDEX_NDD] ignore invalid defaultPlatformStationId: value must be UUID', {
      provided: rawDefaultStationId
    });
  }

  if (!token) {
    return { enabled: false, baseUrl, lang, defaultPlatformStationId };
  }

  return { enabled: true, baseUrl, token, lang, defaultPlatformStationId };
};