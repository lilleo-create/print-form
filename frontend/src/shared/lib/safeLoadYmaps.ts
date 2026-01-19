type YmapsGeoObject = {
  geometry?: {
    getCoordinates: () => number[];
  };
  properties?: {
    get: (key: string) => string | undefined;
  };
  getLocalities?: () => string[];
  getAdministrativeAreas?: () => string[];
  getThoroughfare?: () => string | undefined;
  getDependentLocality?: () => string | undefined;
  getPremiseNumber?: () => string | undefined;
  getAddressLine?: () => string;
};

type YmapsGeocodeResult = {
  geoObjects: {
    get: (index: number) => YmapsGeoObject | undefined;
  };
};

type YmapsMapInstance = {
  setCenter: (coords: number[], zoom?: number) => void;
  destroy: () => void;
  events: {
    add: (event: string, handler: (event: { get: (key: string) => number[] }) => void) => void;
  };
  geoObjects: {
    add: (object: unknown) => void;
    remove: (object: unknown) => void;
  };
};

type YmapsApi = {
  ready: (callback: () => void) => void;
  Map: new (element: HTMLElement, options: Record<string, unknown>) => YmapsMapInstance;
  Placemark: new (coords: number[]) => {
    geometry?: {
      setCoordinates: (coords: number[]) => void;
    };
  };
  geolocation: {
    get: (options: { provider: 'browser' | 'yandex'; mapStateAutoApply: boolean }) => Promise<{
      geoObjects: {
        get: (index: number) => YmapsGeoObject | undefined;
      };
    }>;
  };
  geocode: (request: string | number[]) => Promise<YmapsGeocodeResult>;
};

declare global {
  interface Window {
    ymaps?: YmapsApi;
  }
}

let ymapsPromise: Promise<YmapsApi> | null = null;

export const safeLoadYmaps = () => {
  if (ymapsPromise) {
    return ymapsPromise;
  }

  ymapsPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Yandex Maps is only available in the browser.'));
      return;
    }

    const apiKey = import.meta.env.VITE_YMAPS_API_KEY as string | undefined;
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

export type { YmapsApi, YmapsMapInstance, YmapsGeoObject };
