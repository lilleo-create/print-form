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
  const defaultPlatformStationId =
    process.env.YANDEX_NDD_DEFAULT_PLATFORM_STATION_ID ||
    process.env.YANDEX_NDD_PLATFORM_STATION_ID;

  // Никаких падений сервера из-за пустого токена
  if (!token) {
    return { enabled: false, baseUrl, lang, defaultPlatformStationId };
  }

  return { enabled: true, baseUrl, token, lang, defaultPlatformStationId };
};
