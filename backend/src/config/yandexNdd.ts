export type YandexNddConfig = {
  enabled: boolean;
  baseUrl: string;
  token?: string;
  lang: string;
};

export const NDD_TEST_PLATFORM_STATION_ID = 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924';

export const isYandexNddTestEnvironment = (baseUrl: string): boolean => {
  const normalized = baseUrl.toLowerCase();
  return normalized.includes('.tst.yandex.net');
};

export const getYandexNddConfig = (): YandexNddConfig => {
  const rawBaseUrl = process.env.YANDEX_NDD_BASE_URL || 'https://b2b.taxi.tst.yandex.net';
  const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '');
  const token = process.env.YANDEX_NDD_TOKEN || '';
  const lang = process.env.YANDEX_NDD_LANG || 'ru';

  // Никаких падений сервера из-за пустого токена
  if (!token) {
    return { enabled: false, baseUrl, lang };
  }

  return { enabled: true, baseUrl, token, lang };
};
