import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CdekPvzSelection } from '../components/checkout/CdekPvzPickerModal';

declare global {
  interface Window {
    CDEKWidget?: new (config: Record<string, unknown>) => unknown;
  }
}

const rootId = 'cdek-widget-root';

const toNumber = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const buildSelectionPayload = (address: Record<string, unknown>): CdekPvzSelection => {
  const location = address.location && typeof address.location === 'object'
    ? (address.location as Record<string, unknown>)
    : null;

  return {
    pvzCode: String(address.code ?? ''),
    addressFull: String(address.address_full ?? address.address ?? ''),
    cityName: String(address.city ?? location?.city ?? ''),
    cityCode: toNumber(address.city_code ?? address.cityCode ?? location?.city_code),
    latitude: toNumber(address.latitude ?? location?.latitude),
    longitude: toNumber(address.longitude ?? location?.longitude),
    workTime: typeof address.work_time === 'string' ? address.work_time : undefined,
    raw: address
  };
};

export const CdekWidgetPage = () => {
  const [searchParams] = useSearchParams();
  const city = searchParams.get('city') || 'Москва';
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const initializedRef = useRef(false);

  useEffect(() => {
    initializedRef.current = false;
    setError(null);

    const frame = requestAnimationFrame(() => {
      const root = document.getElementById(rootId);
      if (!root) {
        const reason = 'Не найден контейнер виджета';
        setError(reason);
        window.parent.postMessage({ type: 'CDEK_WIDGET_STATUS', payload: { ok: false, reason } }, window.location.origin);
        console.info('[CDEK][widget][init]', { ok: false, reason });
        return;
      }

      root.innerHTML = '';

      if (!window.CDEKWidget) {
        const reason = 'window.CDEKWidget отсутствует';
        setError(reason);
        window.parent.postMessage({ type: 'CDEK_WIDGET_STATUS', payload: { ok: false, reason } }, window.location.origin);
        console.info('[CDEK][widget][init]', { ok: false, reason });
        return;
      }

      if (initializedRef.current) {
        return;
      }

      initializedRef.current = true;

      new window.CDEKWidget({
        from: city,
        root,
        apiKey: import.meta.env.VITE_YANDEX_MAPS_KEY ?? '',
        servicePath: `${window.location.origin}/api/cdek/widget/service`,
        defaultLocation: city,
        hideDeliveryOptions: {
          door: true
        },
        onReady: () => {
          setError(null);
          window.parent.postMessage({ type: 'CDEK_WIDGET_STATUS', payload: { ok: true } }, window.location.origin);
          console.info('[CDEK][widget][init]', { ok: true });
        },
        onChoose: (
          _type: string,
          _tariff: unknown,
          address: Record<string, unknown>
        ) => {
          const payload = buildSelectionPayload(address);
          window.parent.postMessage({ type: 'CDEK_PVZ_SELECTED', payload }, window.location.origin);
        }
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      initializedRef.current = false;
      const root = document.getElementById(rootId);
      if (root) {
        root.innerHTML = '';
      }
    };
  }, [city, retryToken]);

  return (
    <main style={{ height: '100vh', minHeight: 600, width: '100%' }}>
      {error ? (
        <div style={{ padding: '12px', color: '#b42318' }}>
          Виджет не загрузился
          <button
            type="button"
            onClick={() => setRetryToken((value) => value + 1)}
            style={{ marginLeft: '0.5rem' }}
          >
            Повторить
          </button>
        </div>
      ) : null}
      <div id={rootId} style={{ width: '100%', height: '100%', minHeight: 600 }} />
    </main>
  );
};
