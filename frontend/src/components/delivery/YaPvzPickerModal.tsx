import { useEffect, useRef, useState } from 'react';
import styles from './YaPvzPickerModal.module.css';

const YA_NDD_WIDGET_SRC = 'https://ndd-widget.landpro.site/widget.js';
const YA_NDD_WIDGET_SCRIPT_ID = 'ya-ndd-widget';
const isDev = import.meta.env.DEV;

export type YaPvzSelection = {
  pvzId: string;
  addressFull?: string;
  raw?: unknown;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sel: YaPvzSelection) => void;
  city?: string;
  source_platform_station?: string;
  physical_dims_weight_gross?: number;
  requireSourceStation?: boolean;
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
  city = 'Москва',
  source_platform_station,
  physical_dims_weight_gross = 10000,
  requireSourceStation = false
}: Props) {
  const containerIdRef = useRef(
    `delivery-widget-${Math.random().toString(16).slice(2)}`
  );
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetInitializedRef = useRef(false);
  const selectedOnceRef = useRef(false);

  const [error, setError] = useState<string | null>(null);

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

      const params: Record<string, unknown> = {
        city,
        show_select_button: true,
        size: { width: '100%', height: `${height}px` },
        filter: {
          type: ['pickup_point', 'terminal'],
          is_yandex_branded: false,
          payment_methods: ['already_paid', 'card_on_receipt'],
          payment_methods_filter: 'or'
        }
      };

      if (station) {
        params.source_platform_station = station;
        params.physical_dims_weight_gross = physical_dims_weight_gross;
      }

      debugLog('init height:', height);

      window.YaDelivery.createWidget({
        containerId: containerIdRef.current,
        params
      });

      widgetInitializedRef.current = true;

      // Принудительный пересчёт
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

    // ResizeObserver — чтобы кнопка больше никогда не исчезала
    const ro = new ResizeObserver(() => {
      window.dispatchEvent(new Event('resize'));
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
    };
  }, [
    isOpen,
    city,
    source_platform_station,
    physical_dims_weight_gross,
    requireSourceStation
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

      onSelect({
        pvzId: String(id),
        addressFull:
          (detail?.address as any)?.full_address ??
          (detail?.address as any)?.fullAddress,
        raw: detail
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
          <span>Выберите пункт выдачи</span>
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
          <div
            id={containerIdRef.current}
            ref={hostRef}
            className={styles.widget}
          />
        </div>
      </div>
    </div>
  );
}
