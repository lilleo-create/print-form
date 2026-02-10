import { useCallback, useEffect, useRef, useState } from 'react';
import { checkoutApi, type PickupPointDto, type PickupProvider } from '../api/checkoutApi';
import { safeLoadYmaps } from '../../../shared/lib/safeLoadYmaps';

type Params = {
  isOpen: boolean;
  provider?: PickupProvider;
  radiusKm?: number;
};

const FALLBACK_CENTER = { lat: 55.751244, lng: 37.618423 };

type PickupPointsState = {
  points: PickupPointDto[];
  isLoading: boolean;
  error: string | null;
  center: { lat: number; lng: number };
};

const resolveCenter = async () => {
  try {
    const ymaps = await safeLoadYmaps();
    try {
      const browser = await ymaps.geolocation.get({ provider: 'browser', mapStateAutoApply: false });
      const fromBrowser = browser.geoObjects.get(0)?.geometry?.getCoordinates?.();
      if (fromBrowser) {
        return { lat: fromBrowser[0], lng: fromBrowser[1] };
      }
    } catch {
      // no-op
    }

    const yandex = await ymaps.geolocation.get({ provider: 'yandex', mapStateAutoApply: false });
    const fromYandex = yandex.geoObjects.get(0)?.geometry?.getCoordinates?.();
    if (fromYandex) {
      return { lat: fromYandex[0], lng: fromYandex[1] };
    }
  } catch {
    // no-op
  }

  return FALLBACK_CENTER;
};

export const usePickupPoints = ({ isOpen, provider, radiusKm = 8 }: Params) => {
  const [state, setState] = useState<PickupPointsState>({
    points: [],
    isLoading: false,
    error: null,
    center: FALLBACK_CENTER
  });

  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reload = useCallback(async () => {
    abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const center = await resolveCenter();
      if (controller.signal.aborted) {
        return;
      }

      const points = await checkoutApi.fetchPickupPoints(
        {
          provider,
          lat: center.lat,
          lng: center.lng,
          radiusKm
        },
        controller.signal
      );

      if (controller.signal.aborted) {
        return;
      }

      setState({ points, isLoading: false, error: null, center });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Не удалось загрузить пункты выдачи.'
      }));
    }
  }, [abort, provider, radiusKm]);

  useEffect(() => {
    if (!isOpen) {
      abort();
      return;
    }

    void reload();

    return () => {
      abort();
    };
  }, [abort, isOpen, reload]);

  return {
    ...state,
    reload,
    abort
  };
};
