import { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ensureYaNddWidgetLoaded } from '../../shared/lib/yaNddWidget';
import styles from './YaPvzPickerModal.module.css';

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
  paymentMethods?: Array<
    'already_paid' | 'cash_on_receipt' | 'card_on_receipt'
  >;
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
  москва: { latitude: 55.751244, longitude: 37.618423, zoom: 12 },
  'санкт-петербург': { latitude: 59.93428, longitude: 30.335099, zoom: 12 },
  екатеринбург: { latitude: 56.838926, longitude: 60.605703, zoom: 12 },
  казань: { latitude: 55.796127, longitude: 49.106414, zoom: 12 }
};

const getCityCenter = (city: string): MapCenter => {
  const normalized = city.trim().toLowerCase();
  return CITY_CENTERS[normalized] ?? CITY_CENTERS['москва'];
};

const debounce = <T extends (...args: unknown[]) => void>(
  fn: T,
  timeoutMs: number
) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), timeoutMs);
  };
};

const isDev = import.meta.env.DEV;

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
  const containerId = useRef(
    `ya-ndd-widget-${Math.random().toString(16).slice(2)}`
  );
  const widgetInitializedRef = useRef(false);
  const openCountRef = useRef(0);

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
    const onPointSelected = (evt: Event) => {
      const detail = (evt as CustomEvent<WidgetPointDetail | undefined>)
        ?.detail;
      if (!detail?.id) return;

      if (isDev) {
        console.info('[YaNddPvzModal] YaNddWidgetPointSelected', {
          id: detail.id,
          address: detail?.address?.full_address,
          detail
        });
      }

      onSelectRef.current({
        pvzId: String(detail.id),
        addressFull: detail?.address?.full_address,
        raw: detail
      });

      onCloseRef.current();
    };

    document.addEventListener('YaNddWidgetPointSelected', onPointSelected);

    return () => {
      document.removeEventListener('YaNddWidgetPointSelected', onPointSelected);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    openCountRef.current += 1;
    if (isDev) {
      console.info('[YaNddPvzModal][DEV harness] modal open', {
        openCount: openCountRef.current,
        widgetInitialized: widgetInitializedRef.current,
        containerId: containerId.current
      });
    }

    let cancelled = false;
    let onBoundsChanged: ((evt: Event) => void) | null = null;

    const updateWidget = async () => {
      setLoading(true);
      setError('');

      try {
        await ensureYaNddWidgetLoaded();
        if (cancelled) return;

        const yaDelivery = window.YaDelivery;
        const createWidget = yaDelivery?.createWidget;
        const setParams = yaDelivery?.setParams;

        const container = document.getElementById(containerId.current);
        if (!container) throw new Error('Контейнер виджета ПВЗ не найден.');

        const rectBefore = container.getBoundingClientRect();
        const widgetHeightPx = Math.max(
          Math.round(rectBefore.height || 0),
          520
        );
        const fallbackCenter = getCityCenter(city);
        const filterType = includeTerminals
          ? ['pickup_point', 'terminal']
          : ['pickup_point'];

        if (isDev) {
          console.info('[YaNddPvzModal][DEV] before create/update', {
            rectBefore,
            hasYaDelivery: Boolean(yaDelivery),
            hasSetParams: typeof setParams === 'function',
            hasCreateWidget: typeof createWidget === 'function',
            widgetHeightPx
          });
        }

        const widgetParams: Record<string, unknown> = {
          city,
          size: { width: '100%', height: widgetHeightPx },
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

        if (!widgetInitializedRef.current) {
          if (typeof createWidget !== 'function') {
            throw new Error('YaDelivery.createWidget недоступен.');
          }
          createWidget({
            containerId: containerId.current,
            params: widgetParams
          });
          widgetInitializedRef.current = true;
        } else if (typeof setParams === 'function') {
          setParams(widgetParams);
        }

        if (typeof setParams === 'function') {
          const updateViewport = debounce((detail: unknown) => {
            const bounds = (detail as WidgetBoundsDetail | undefined)?.bounds;
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

          document.addEventListener(
            'YaNddWidgetBoundsChanged',
            onBoundsChanged
          );

          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                if (cancelled) return;

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
                if (cancelled) return;

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

          const rectAfter = container.getBoundingClientRect();
          if (isDev) {
            console.info('[YaNddPvzModal][DEV] after create/update', {
              rectAfter,
              hasSetParams: typeof setParams === 'function'
            });
          }
        } else {
          const rectAfter = container.getBoundingClientRect();
          if (isDev) {
            console.info('[YaNddPvzModal][DEV] after create/update', {
              rectAfter,
              hasSetParams: false
            });
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Ошибка инициализации виджета ПВЗ'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void updateWidget();

    return () => {
      cancelled = true;
      if (onBoundsChanged) {
        document.removeEventListener(
          'YaNddWidgetBoundsChanged',
          onBoundsChanged
        );
      }
    };
  }, [
    isOpen,
    city,
    includeTerminals,
    activePaymentMethods,
    sourcePlatformStationId,
    weightGrossG
  ]);

  const modal = (
    <div
      onClick={() => onCloseRef.current()}
      className={`${styles.overlay} ${isOpen ? styles.overlayOpen : styles.overlayClosed}`}
      aria-hidden={!isOpen}
    >
      <div onClick={(e) => e.stopPropagation()} className={styles.modal}>
        <div className={styles.header}>
          <span>{title}</span>
          <button
            onClick={() => onCloseRef.current()}
            className={styles.closeButton}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          <div id={containerId.current} className={styles.widgetContainer} />

          {loading && isOpen && (
            <div className={styles.loading}>Загружаю виджет ПВЗ…</div>
          )}

          {error && isOpen && <div className={styles.error}>{error}</div>}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, portalRoot);
};
