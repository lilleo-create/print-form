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
  const rawBaseUrl = process.env.YANDEX_NDD_BASE_URL || 'https://b2b-authproxy.taxi.yandex.net';
  const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '');
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
