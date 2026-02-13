import { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ensureYaNddWidgetLoaded } from '../../shared/lib/yaNddWidget';

export type YaPvzSelection = {
  pvzId: string;
  addressFull?: string;
  raw?: unknown;
};

type YaNddPvzModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sel: YaPvzSelection) => void;
  title?: string;
  city?: string;
  sourcePlatformStationId?: string;
  weightGrossG?: number;
  includeTerminals?: boolean;
  paymentMethods?: Array<'already_paid' | 'cash_on_receipt' | 'card_on_receipt'>;
};

type MapCenter = {
  latitude: number;
  longitude: number;
  zoom?: number;
};

type WidgetPointDetail = {
  id?: string | number;
  address?: { full_address?: string };
  [key: string]: unknown;
};

type WidgetBoundsDetail = {
  bounds?: unknown;
};


const DEFAULT_PAYMENT_METHODS: Array<'already_paid' | 'card_on_receipt'> = [
  'already_paid',
  'card_on_receipt'
];

const CITY_CENTERS: Record<string, MapCenter> = {
  'москва': { latitude: 55.751244, longitude: 37.618423, zoom: 12 },
  'санкт-петербург': { latitude: 59.93428, longitude: 30.335099, zoom: 12 },
  'екатеринбург': { latitude: 56.838926, longitude: 60.605703, zoom: 12 },
  'казань': { latitude: 55.796127, longitude: 49.106414, zoom: 12 }
};

const getCityCenter = (city: string): MapCenter => {
  const normalized = city.trim().toLowerCase();
  return CITY_CENTERS[normalized] ?? CITY_CENTERS['москва'];
};

const debounce = <T extends (...args: unknown[]) => void>(fn: T, timeoutMs: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), timeoutMs);
  };
};

export const YaNddPvzModal = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Выберите ПВЗ получения',
  city = 'Москва',
  sourcePlatformStationId,
  weightGrossG = 10000,
  includeTerminals = true,
  paymentMethods
}: YaNddPvzModalProps) => {
  const containerId = useMemo(
    () => `ya-ndd-widget-${Math.random().toString(16).slice(2)}`,
    []
  );

  const portalRoot = useMemo(() => {
    const el = document.createElement('div');
    el.setAttribute('data-ya-ndd-portal-root', 'true');
    return el;
  }, []);

  const onCloseRef = useRef(onClose);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const activePaymentMethods = useMemo(
    () => paymentMethods ?? DEFAULT_PAYMENT_METHODS,
    [paymentMethods]
  );

  useEffect(() => {
    document.body.appendChild(portalRoot);
    return () => portalRoot.remove();
  }, [portalRoot]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    let onBoundsChanged: ((evt: Event) => void) | null = null;

    const onPointSelected = (evt: Event) => {
      const detail = (evt as CustomEvent<WidgetPointDetail | undefined>)?.detail;
      if (!detail?.id) return;

      onSelectRef.current({
        pvzId: String(detail.id),
        addressFull: detail?.address?.full_address,
        raw: detail
      });

      onCloseRef.current();
    };

    const init = async () => {
      setLoading(true);
      setError('');

      try {
        await ensureYaNddWidgetLoaded();
        if (cancelled) return;

        const yaDelivery = window.YaDelivery;
        const createWidget = yaDelivery?.createWidget;
        const setParams = yaDelivery?.setParams;

        if (typeof createWidget !== 'function') {
          throw new Error('YaDelivery.createWidget недоступен.');
        }

        document.addEventListener('YaNddWidgetPointSelected', onPointSelected);

        const container = document.getElementById(containerId);
        if (!container) {
          document.removeEventListener('YaNddWidgetPointSelected', onPointSelected);
          return;
        }

        container.innerHTML = '';

        const fallbackCenter = getCityCenter(city);
        const filterType = includeTerminals
          ? ['pickup_point', 'terminal']
          : ['pickup_point'];

        const widgetParams: Record<string, unknown> = {
          city,
          size: { width: '100%', height: '100%' },
          show_select_button: true,
          physical_dims_weight_gross: weightGrossG,
          map: {
            center: {
              latitude: fallbackCenter.latitude,
              longitude: fallbackCenter.longitude
            },
            zoom: fallbackCenter.zoom,
            radius_m: 10000
          },
          ...(sourcePlatformStationId
            ? { source_platform_station: sourcePlatformStationId }
            : {}),
          filter: {
            type: filterType,
            is_yandex_branded: false,
            ...(activePaymentMethods.length > 0
              ? {
                  payment_methods: activePaymentMethods,
                  payment_methods_filter: 'or'
                }
              : {})
          }
        };

        createWidget({ containerId, params: widgetParams });

        const updateViewport = debounce((detail: WidgetBoundsDetail | undefined) => {
          if (typeof setParams !== 'function') return;
          const bounds = detail?.bounds;
          if (!bounds) return;

          setParams({
            map: {
              bounds,
              radius_m: 15000
            }
          });
        }, 400);

        onBoundsChanged = (evt: Event) => {
          const detail = (evt as CustomEvent)?.detail;
          updateViewport(detail);
        };

        document.addEventListener('YaNddWidgetBoundsChanged', onBoundsChanged);

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (cancelled || typeof setParams !== 'function') return;

              setParams({
                map: {
                  center: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                  },
                  zoom: 14,
                  radius_m: 7000
                }
              });
            },
            () => {
              if (cancelled || typeof setParams !== 'function') return;
              setParams({
                map: {
                  center: {
                    latitude: fallbackCenter.latitude,
                    longitude: fallbackCenter.longitude
                  },
                  zoom: fallbackCenter.zoom,
                  radius_m: 10000
                }
              });
            },
            { timeout: 6000, maximumAge: 300000, enableHighAccuracy: false }
          );
        }

        if (cancelled && onBoundsChanged) {
          document.removeEventListener('YaNddWidgetBoundsChanged', onBoundsChanged);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Ошибка инициализации виджета ПВЗ');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
      document.removeEventListener('YaNddWidgetPointSelected', onPointSelected);
      if (onBoundsChanged) {
        document.removeEventListener('YaNddWidgetBoundsChanged', onBoundsChanged);
      }

      const container = document.getElementById(containerId);
      if (container) container.innerHTML = '';
    };
  }, [
    isOpen,
    city,
    containerId,
    includeTerminals,
    activePaymentMethods,
    sourcePlatformStationId,
    weightGrossG
  ]);

  if (!isOpen) return null;

  const modal = (
    <div
      onClick={() => onCloseRef.current()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1100px, 96vw)',
          height: 'min(720px, 90vh)',
          background: '#0b1630',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateRows: '56px 1fr'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            fontWeight: 600
          }}
        >
          <span>{title}</span>
          <button
            onClick={() => onCloseRef.current()}
            style={{
              cursor: 'pointer',
              background: 'transparent',
              border: 0,
              color: 'inherit',
              fontSize: 22,
              lineHeight: 1,
              padding: 8
            }}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div style={{ position: 'relative', height: '100%' }}>
          <div
            id={containerId}
            style={{
              width: '100%',
              height: '100%',
              background: 'rgba(255,255,255,0.06)'
            }}
          />

          {loading && (
            <div
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 12,
                padding: 10,
                borderRadius: 10,
                background: 'rgba(0,0,0,0.35)',
                color: '#fff',
                fontSize: 13
              }}
            >
              Загружаю виджет ПВЗ…
            </div>
          )}

          {error && (
            <div
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 12,
                padding: 10,
                borderRadius: 10,
                background: 'rgba(255, 0, 0, 0.18)',
                border: '1px solid rgba(255, 0, 0, 0.35)',
                color: '#fff',
                fontSize: 13,
                whiteSpace: 'pre-wrap'
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, portalRoot);
};
