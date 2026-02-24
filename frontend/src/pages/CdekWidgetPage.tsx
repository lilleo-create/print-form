import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CdekPvzSelection } from '../components/checkout/CdekPvzPickerModal';

declare global {
  interface Window {
    CDEKWidget?: new (config: Record<string, unknown>) => unknown;
  }
}

const CDEK_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@cdek-it/widget@3';
const rootId = 'cdek-widget-root';

const toNumber = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const buildSelectionPayload = (address: Record<string, unknown>): CdekPvzSelection => {
  const location =
    address.location && typeof address.location === 'object'
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

function loadCdekScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.CDEKWidget) {
      resolve();
      return;
    }

    const existing = document.querySelector(`script[src="${CDEK_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Ошибка загрузки скрипта CDEK')));
      return;
    }

    const script = document.createElement('script');
    script.src = CDEK_SCRIPT_URL;
    script.charset = 'utf-8';
    script.type = 'text/javascript';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Ошибка загрузки скрипта CDEK'));
    document.head.appendChild(script);
  });
}

export const CdekWidgetPage = () => {
  const [searchParams] = useSearchParams();
  const city = searchParams.get('city') || 'Москва';
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const initializedRef = useRef(false);

  useEffect(() => {
    initializedRef.current = false;
    setError(null);

    let cancelled = false;

    const init = async () => {
      try {
        await loadCdekScript();
      } catch (e) {
        if (cancelled) return;
        const reason = e instanceof Error ? e.message : 'Ошибка загрузки скрипта CDEK';
        setError(reason);
        window.parent.postMessage(
          { type: 'CDEK_WIDGET_STATUS', payload: { ok: false, reason } },
          window.location.origin
        );
        return;
      }

      if (cancelled) return;

      const root = document.getElementById(rootId);
      if (!root) {
        const reason = 'Не найден контейнер виджета';
        setError(reason);
        window.parent.postMessage(
          { type: 'CDEK_WIDGET_STATUS', payload: { ok: false, reason } },
          window.location.origin
        );
        return;
      }

      if (!window.CDEKWidget) {
        const reason = 'window.CDEKWidget отсутствует после загрузки скрипта';
        setError(reason);
        window.parent.postMessage(
          { type: 'CDEK_WIDGET_STATUS', payload: { ok: false, reason } },
          window.location.origin
        );
        return;
      }

      if (initializedRef.current) return;
      initializedRef.current = true;

      root.innerHTML = '';

      new window.CDEKWidget({
        from: city,
        root: rootId,
        apiKey: import.meta.env.VITE_YMAPS_API_KEY ?? '',
        servicePath: `${window.location.origin}/api/cdek/widget/service`,
        defaultLocation: city,
        hideDeliveryOptions: { door: true },
        onReady: () => {
          if (cancelled) return;
          setError(null);
          window.parent.postMessage(
            { type: 'CDEK_WIDGET_STATUS', payload: { ok: true } },
            window.location.origin
          );
        },
        onChoose: (
          _type: string,
          _tariff: unknown,
          address: Record<string, unknown>
        ) => {
          if (cancelled) return;
          const payload = buildSelectionPayload(address);
          window.parent.postMessage(
            { type: 'CDEK_PVZ_SELECTED', payload },
            window.location.origin
          );
        }
      });
    };

    void init();

    return () => {
      cancelled = true;
      initializedRef.current = false;
      const root = document.getElementById(rootId);
      if (root) root.innerHTML = '';
    };
  }, [city, retryToken]);

  return (
    <main style={{ height: '100vh', minHeight: 600, width: '100%' }}>
      {error ? (
        <div style={{ padding: '12px', color: '#b42318' }}>
          {error}
          <button
            type="button"
            onClick={() => setRetryToken((v) => v + 1)}
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
