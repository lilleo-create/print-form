import { useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api';
import styles from './YaPvzPickerModal.module.css';

const YA_NDD_WIDGET_SRC = 'https://ndd-widget.landpro.site/widget.js';
const YA_NDD_WIDGET_SCRIPT_ID = 'ya-ndd-widget';
const isDev = import.meta.env.DEV;

export type YaPvzSelection = {
  pvzId: string;
  buyerPickupStationId?: string;
  addressFull?: string;
  raw?: unknown;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sel: YaPvzSelection) => void;
  mode?: 'pickup' | 'warehouse';
  city?: string;
  geoId?: number;
  source_platform_station?: string;
  physical_dims_weight_gross?: number;
  requireSourceStation?: boolean;
  onNoStationsInCity?: (hasNoStations: boolean) => void;
};

type DropoffStation = {
  id: string;
  position: { latitude?: number; longitude?: number } | null;
};

declare global {
  interface Window {
    YaDelivery?: {
      createWidget: (args: {
        containerId: string;
        params: Record<string, unknown>;
      }) => void;
      setParams?: (params: Record<string, unknown>) => void;
    };
  }
}

const debugLog = (...args: unknown[]) => {
  if (isDev) console.debug('[YaPvzPickerModal]', ...args);
};

function ensureWidgetScriptLoaded() {
  if (window.YaDelivery?.createWidget) return;

  if (!document.getElementById(YA_NDD_WIDGET_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = YA_NDD_WIDGET_SCRIPT_ID;
    script.src = YA_NDD_WIDGET_SRC;
    script.async = true;
    document.head.appendChild(script);
    debugLog('script appended');
  }
}

export function YaPvzPickerModal({
  isOpen,
  onClose,
  onSelect,
  mode = 'pickup',
  city = 'Москва',
  geoId,
  source_platform_station,
  physical_dims_weight_gross = 10000,
  requireSourceStation = false,
  onNoStationsInCity
}: Props) {
  const containerIdRef = useRef(
    `delivery-widget-${Math.random().toString(16).slice(2)}`
  );
  const hostRef = useRef<HTMLDivElement | null>(null);
  const selectedOnceRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [dropoffStations, setDropoffStations] = useState<DropoffStation[] | null>(
    null
  );
  const warehouseMode = mode === 'warehouse';
  const usePreloadedStations = warehouseMode && typeof geoId === 'number';

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;

    const originalStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width
    };

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = originalStyle.overflow;
      document.body.style.position = originalStyle.position;
      document.body.style.top = originalStyle.top;
      document.body.style.width = originalStyle.width;

      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setDropoffStations(null);
    setError(null);

    const loadStations = async () => {
      if (!usePreloadedStations) {
        setDropoffStations([]);
        onNoStationsInCity?.(false);
        return;
      }

      try {
        const response = await api.getSellerDropoffStations({ geoId: geoId as number, limit: 300 });
        if (cancelled) return;
        const incoming = Array.isArray(response.data.points) ? response.data.points : [];
        const reasons = {
          missingId: 0,
          missingPosition: 0
        };
        const points = incoming
          .map((point) => ({
            id: String(point.pvzId ?? point.id ?? '').trim(),
            position: point.position ?? null
          }))
          .filter((point) => {
            if (!point.id) {
              reasons.missingId += 1;
              return false;
            }
            if (!point.position?.latitude || !point.position?.longitude) {
              reasons.missingPosition += 1;
            }
            return true;
          });

        console.info('[YaPvzPickerModal] station points diagnostics', {
          mode,
          incomingStationsCount: incoming.length,
          afterFiltersCount: points.length,
          pointsCount: points.length,
          filterReasons: reasons
        });

        setDropoffStations(points);
        const noStations = points.length === 0;
        onNoStationsInCity?.(noStations);
        if (noStations) {
          setError('В этом городе нет доступных станций сдачи (warehouse). Попробуйте другой город.');
        }
      } catch {
        if (cancelled) return;
        setDropoffStations([]);
        onNoStationsInCity?.(false);
        setError('Не удалось загрузить станции сдачи. Попробуйте позже.');
      }
    };

    void loadStations();

    return () => {
      cancelled = true;
    };
  }, [geoId, isOpen, mode, onNoStationsInCity, usePreloadedStations]);

  useEffect(() => {
    if (!isOpen) return;
    if (dropoffStations === null) return;
    if (usePreloadedStations && dropoffStations.length === 0) return;

    const host = hostRef.current;
    if (!host) return;

    const station = (source_platform_station ?? '').trim();
    if (requireSourceStation && !station) {
      setError('Не задан source_platform_station.');
      return;
    }

    setError(null);
    ensureWidgetScriptLoaded();

    const initWidget = () => {
      if (!window.YaDelivery?.createWidget) return;

      const rect = host.getBoundingClientRect();
      const height = Math.max(600, Math.floor(rect.height));
      const firstPoint = usePreloadedStations ? dropoffStations[0] : null;

      const isUuid = (value: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      const stationIds = usePreloadedStations
        ? dropoffStations.map((point) => point.id).filter(Boolean)
        : [];
      const warehouseIdsLookLikePvz =
        warehouseMode && stationIds.length > 0 && stationIds.every((id) => isUuid(id));

      if (warehouseIdsLookLikePvz) {
        console.warn('[YaPvzPickerModal] warehouse mode received UUID-like station ids; disabling strict warehouse type filter to avoid empty map', {
          mode,
          stationIdsCount: stationIds.length
        });
      }

      const params: Record<string, unknown> = {
        city,
        show_select_button: true,
        size: { width: '100%', height: `${height}px` },
        filter: {
          type: warehouseMode
            ? warehouseIdsLookLikePvz
              ? undefined
              : ['warehouse']
            : ['pickup_point', 'terminal'],
          pickup_point_ids: stationIds.length ? stationIds : undefined,
          available_for_dropoff: warehouseMode ? true : undefined,
          is_yandex_branded: false,
          payment_methods: ['already_paid', 'card_on_receipt'],
          payment_methods_filter: 'or'
        },
        map: firstPoint?.position?.latitude && firstPoint?.position?.longitude
          ? {
              center: {
                latitude: firstPoint.position.latitude,
                longitude: firstPoint.position.longitude
              }
            }
          : undefined
      };

      if (warehouseMode && station) {
        params.source_platform_station = station;
        params.physical_dims_weight_gross = physical_dims_weight_gross;
      }

      debugLog('init height:', height, 'points', dropoffStations.length);

      window.YaDelivery.createWidget({
        containerId: containerIdRef.current,
        params
      });

      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    };

    if (window.YaDelivery?.createWidget) {
      initWidget();
    } else {
      document.addEventListener('YaNddWidgetLoad', initWidget, { once: true });
      setTimeout(() => {
        if (window.YaDelivery?.createWidget) initWidget();
      }, 1200);
    }

    const ro = new ResizeObserver(() => {
      window.dispatchEvent(new Event('resize'));
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
    };
  }, [
    city,
    dropoffStations,
    isOpen,
    mode,
    physical_dims_weight_gross,
    requireSourceStation,
    source_platform_station,
    usePreloadedStations
  ]);

  useEffect(() => {
    const onPointSelected = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      const id =
        (typeof detail?.id === 'string' && detail.id.trim()) ||
        (detail?.point && typeof (detail.point as Record<string, unknown>).id === 'string'
          ? String((detail.point as Record<string, unknown>).id).trim()
          : '');
      if (!id || selectedOnceRef.current) return;

      console.debug('[YaPvzPickerModal] point selected', {
        id,
        operator_station_id:
          detail?.operator_station_id ??
          (detail?.point && (detail.point as Record<string, unknown>).operator_station_id),
        type: detail?.type ?? (detail?.point && (detail.point as Record<string, unknown>).type),
        available_for_dropoff:
          detail?.available_for_dropoff ??
          (detail?.point && (detail.point as Record<string, unknown>).available_for_dropoff)
      });

      selectedOnceRef.current = true;

      const point =
        detail?.point && typeof detail.point === 'object'
          ? (detail.point as Record<string, unknown>)
          : detail;
      const buyerPickupStationId =
        typeof point?.operator_station_id === 'string'
          ? point.operator_station_id
          : typeof detail?.operator_station_id === 'string'
            ? detail.operator_station_id
            : undefined;

      onSelect({
        pvzId: String(id),
        addressFull:
          (point?.address as any)?.full_address ??
          (point?.address as any)?.fullAddress ??
          (detail?.address as any)?.full_address ??
          (detail?.address as any)?.fullAddress,
        raw: point,
        ...(buyerPickupStationId ? { buyerPickupStationId } : {})
      });

      onClose();

      setTimeout(() => {
        selectedOnceRef.current = false;
      }, 0);
    };

    document.addEventListener(
      'YaNddWidgetPointSelected',
      onPointSelected as EventListener
    );

    return () =>
      document.removeEventListener(
        'YaNddWidgetPointSelected',
        onPointSelected as EventListener
      );
  }, [onClose, onSelect]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <span>{warehouseMode ? 'Выберите станцию сдачи (warehouse)' : 'Выберите пункт выдачи'}</span>
            {warehouseMode ? (
              <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem', marginBottom: 0 }}>
                Для сдачи заказов доступны только склады (warehouse). Обычные ПВЗ не подходят.
              </p>
            ) : (
              <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem', marginBottom: 0 }}>
                Выберите ПВЗ или постамат для получения заказа.
              </p>
            )}
          </div>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          {error && <div className={styles.error}>{error}</div>}
          {!error && usePreloadedStations && dropoffStations === null ? (
            <div className={styles.error}>{warehouseMode ? 'Загружаем станции сдачи…' : 'Загружаем пункты выдачи…'}</div>
          ) : null}
          {!error ? (
            <div
              id={containerIdRef.current}
              ref={hostRef}
              className={styles.widget}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
