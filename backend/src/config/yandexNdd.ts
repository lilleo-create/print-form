export type YandexNddConfig = {
  enabled: boolean;
  baseUrl: string;
  token?: string;
  lang: string;
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
