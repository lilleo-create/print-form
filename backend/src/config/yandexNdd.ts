const DEFAULT_BASE_URL = 'https://b2b.taxi.tst.yandex.net';
const DEFAULT_LANG = 'ru';

const readRequired = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`[YANDEX_NDD] Missing required env: ${key}`);
  }
  return value;
};

export const getYandexNddConfig = () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isDev = nodeEnv !== 'production';

  const baseUrl = (process.env.YANDEX_NDD_BASE_URL ?? DEFAULT_BASE_URL).trim().replace(/\/$/, '');
  const lang = (process.env.YANDEX_NDD_LANG ?? DEFAULT_LANG).trim() || DEFAULT_LANG;
  const token = process.env.YANDEX_NDD_TOKEN?.trim();

  if (!token && isDev) {
    throw new Error('[YANDEX_NDD] Set YANDEX_NDD_TOKEN in .env to enable NDD delivery API integration.');
  }

  return {
    baseUrl,
    lang,
    token: token ?? readRequired('YANDEX_NDD_TOKEN')
  };
};

