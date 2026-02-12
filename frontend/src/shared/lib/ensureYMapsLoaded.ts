declare global {
  interface Window {
    ymaps?: any;
    __ymapsLoadingPromise?: Promise<void>;
  }
}

export async function ensureYMapsLoaded(params: {
  apikey: string;
  lang?: string;
  suggestApikey?: string;
}): Promise<void> {
  const { apikey, lang = 'ru_RU', suggestApikey } = params;

  if (window.ymaps) return;

  if (!window.__ymapsLoadingPromise) {
    window.__ymapsLoadingPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-ymaps="true"]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('YMaps script load error')));
        return;
      }

      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.dataset.ymaps = 'true';

      const url = new URL('https://api-maps.yandex.ru/2.1/');
      url.searchParams.set('lang', lang);
      url.searchParams.set('apikey', apikey);
      if (suggestApikey) url.searchParams.set('suggest_apikey', suggestApikey);

      script.src = url.toString();

      script.onload = () => resolve();
      script.onerror = () => reject(new Error('YMaps script load error'));

      document.head.appendChild(script);
    });
  }

  await window.__ymapsLoadingPromise;

  // дождёмся готовности API
  await new Promise<void>((resolve) => window.ymaps.ready(() => resolve()));
}
