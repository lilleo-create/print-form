import { normalizeDigitsStation } from '../services/yandexNdd/getOperatorStationId';

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
  const baseUrl = baseUrlWithoutApi;
  const token = process.env.YANDEX_NDD_TOKEN || '';
  const lang = process.env.YANDEX_NDD_LANG || 'ru';
  const rawDefaultPlatformStationId =
    process.env.YANDEX_NDD_DEFAULT_PLATFORM_STATION_ID ||
    process.env.YANDEX_NDD_PLATFORM_STATION_ID;
  const defaultPlatformStationId = normalizeDigitsStation(rawDefaultPlatformStationId);

  if (rawDefaultPlatformStationId && !defaultPlatformStationId) {
    console.warn('[YANDEX_NDD] ignore invalid defaultPlatformStationId: value must contain digits only', {
      provided: rawDefaultPlatformStationId
    });
  }

  // Никаких падений сервера из-за пустого токена
  if (!token) {
    return { enabled: false, baseUrl, lang, defaultPlatformStationId: defaultPlatformStationId ?? undefined };
  }

  return { enabled: true, baseUrl, token, lang, defaultPlatformStationId: defaultPlatformStationId ?? undefined };
};
