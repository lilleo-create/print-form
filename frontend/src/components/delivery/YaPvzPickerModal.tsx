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

  /**
   * Для checkout (расчёт сроков/стоимости) — нужен.
   * Для выбора dropoff ПВЗ продавца — не обязателен.
   */
  source_platform_station?: string;

  physical_dims_weight_gross?: number;

  /**
   * true: без source_platform_station покажем ошибку (checkout).
   * false: можно открывать без station (seller выбирает dropoff).
   */
  requireSourceStation?: boolean;
};

declare global {
  interface Window {
    YaDelivery?: {
      createWidget: (args: { containerId: string; params: Record<string, unknown> }) => void;
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
    debugLog('script appended', YA_NDD_WIDGET_SRC);
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
  const containerIdRef = useRef(`delivery-widget-${Math.random().toString(16).slice(2)}`);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const onCloseRef = useRef(onClose);
  const onSelectRef = useRef(onSelect);

  const selectedOnceRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
    onSelectRef.current = onSelect;
  }, [onClose, onSelect]);

  // ESC close
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const host = hostRef.current;
    if (!host) {
      setError('Не удалось подготовить контейнер виджета ПВЗ.');
      return;
    }

    setError(null);
    selectedOnceRef.current = false;

    // важное: чистим DOM виджета при каждом открытии
    host.innerHTML = '';

    const station = (source_platform_station ?? '').trim();
    if (requireSourceStation && !station) {
      setError('Не задан source_platform_station. Укажите станцию отгрузки продавца.');
      return;
    }

    // ширина контейнера должна быть нормальной ДО createWidget
    host.style.width = '100%';
    host.style.minWidth = '0';

    ensureWidgetScriptLoaded();

    let cancelled = false;
    let timeoutId: number | null = null;

    const startWidget = () => {
      if (cancelled) return;

      const ya = window.YaDelivery;
      if (!ya?.createWidget) return;

      const params: Record<string, unknown> = {
        city,
        size: { width: '100%', height: '780px' },
        show_select_button: true,
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

      debugLog('createWidget', { containerId: containerIdRef.current, params });

      ya.createWidget({
        containerId: containerIdRef.current,
        params
      });

      // “пинок” для пересчёта размеров карты (иначе иногда 0px)
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 800);
    };

    const onPointSelected = (event: Event) => {
      if (cancelled || selectedOnceRef.current) return;

      const detail = (event as CustomEvent<Record<string, unknown>>).detail as Record<string, unknown> | undefined;
      const id = detail?.id;
      if (!id) return;

      selectedOnceRef.current = true;

      const addressObj = detail?.address as Record<string, unknown> | undefined;

      const addressFull =
        (addressObj?.full_address as string | undefined) ??
        (addressObj?.fullAddress as string | undefined) ??
        (detail?.full_address as string | undefined) ??
        (detail?.fullAddress as string | undefined);

      onSelectRef.current({
        pvzId: String(id),
        addressFull,
        raw: detail
      });

      onCloseRef.current();
    };

    document.addEventListener('YaNddWidgetPointSelected', onPointSelected as EventListener);

    // стартуем сразу (у тебя “900px wait” никогда не выполнится, потому что виджет сам режет ширину)
    if (window.YaDelivery?.createWidget) startWidget();
    else document.addEventListener('YaNddWidgetLoad', startWidget, { once: true });

    // запасной старт
    timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      if (window.YaDelivery?.createWidget) startWidget();
    }, 1500);

    return () => {
      cancelled = true;
      selectedOnceRef.current = false;

      document.removeEventListener('YaNddWidgetPointSelected', onPointSelected as EventListener);
      document.removeEventListener('YaNddWidgetLoad', startWidget);

      if (timeoutId !== null) window.clearTimeout(timeoutId);

      host.innerHTML = '';
    };
  }, [isOpen, city, source_platform_station, physical_dims_weight_gross, requireSourceStation]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span>Выберите пункт выдачи</span>
          <button className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className={styles.body}>
          {error ? <div className={styles.error}>{error}</div> : null}
          <div id={containerIdRef.current} ref={hostRef} className={styles.widget} aria-hidden={Boolean(error)} />
        </div>
      </div>
    </div>
  );
}
