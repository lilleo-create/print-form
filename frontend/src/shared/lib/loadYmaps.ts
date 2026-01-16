declare global {
  interface Window {
    ymaps?: {
      ready: (callback: () => void) => void;
      Map: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
      Placemark: new (coords: number[]) => unknown;
      geocode: (request: string | number[]) => Promise<{
        geoObjects: {
          get: (index: number) => {
            geometry?: {
              getCoordinates: () => number[];
            };
            getLocalities?: () => string[];
            getAdministrativeAreas?: () => string[];
            getThoroughfare?: () => string | undefined;
            getDependentLocality?: () => string | undefined;
            getPremiseNumber?: () => string | undefined;
          } | undefined;
        };
      }>;
    };
  }
}

let ymapsPromise: Promise<NonNullable<Window['ymaps']>> | null = null;

export const loadYmaps = () => {
  if (ymapsPromise) {
    return ymapsPromise;
  }

  ymapsPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Yandex Maps is only available in the browser.'));
      return;
    }

    const apiKey = import.meta.env.VITE_YMAPS_API_KEY;
    if (!apiKey) {
      reject(new Error('Missing VITE_YMAPS_API_KEY.'));
      return;
    }

    if (window.ymaps) {
      window.ymaps.ready(() => resolve(window.ymaps!));
      return;
    }

    const scriptId = 'ymaps-sdk';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => window.ymaps?.ready(() => resolve(window.ymaps!)));
      existing.addEventListener('error', () => reject(new Error('Failed to load Yandex Maps.')));
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.onload = () => window.ymaps?.ready(() => resolve(window.ymaps!));
    script.onerror = () => reject(new Error('Failed to load Yandex Maps.'));
    document.head.appendChild(script);
  });

  return ymapsPromise;
};
