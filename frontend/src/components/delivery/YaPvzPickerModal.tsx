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
  source_platform_station: string;
  physical_dims_weight_gross?: number;
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
  if (isDev) {
    console.debug('[YaPvzPickerModal]', ...args);
  }
};

function ensureWidgetScriptLoaded() {
  if (window.YaDelivery?.createWidget) {
    debugLog('script already available on window');
    return;
  }

  if (!document.getElementById(YA_NDD_WIDGET_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = YA_NDD_WIDGET_SCRIPT_ID;
    script.src = YA_NDD_WIDGET_SRC;
    script.async = true;
    document.head.appendChild(script);
    debugLog('script appended', YA_NDD_WIDGET_SRC);
    return;
  }

  debugLog('script tag already exists');
}

export function YaPvzPickerModal({
  isOpen,
  onClose,
  onSelect,
  city = 'Москва',
  source_platform_station,
  physical_dims_weight_gross = 10000
}: Props) {
  const containerIdRef = useRef(`delivery-widget-${Math.random().toString(16).slice(2)}`);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onSelectRef = useRef(onSelect);
  const selectedOnceRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
    onSelectRef.current = onSelect;
  }, [onClose, onSelect]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      setError('Не удалось подготовить контейнер виджета ПВЗ.');
      return;
    }

    setError(null);
    selectedOnceRef.current = false;
    container.innerHTML = '';

    if (!source_platform_station.trim()) {
      setError('Не задан source_platform_station. Укажите станцию отгрузки продавца.');
      return;
    }

    ensureWidgetScriptLoaded();

    let cancelled = false;
    let rafId: number | null = null;
    let timeoutId: number | null = null;
    let widthResolved = false;

    const startWidget = () => {
      if (cancelled || !window.YaDelivery?.createWidget) {
        return;
      }

      debugLog('createWidget called', {
        city,
        source_platform_station,
        physical_dims_weight_gross
      });

      window.YaDelivery.createWidget({
        containerId: containerIdRef.current,
        params: {
          city,
          size: {
            width: '100%',
            height: '780px'
          },
          source_platform_station,
          physical_dims_weight_gross,
          show_select_button: true
        }
      });
    };

    const onPointSelected = (event: Event) => {
      if (cancelled || selectedOnceRef.current) {
        return;
      }

      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      const id = detail?.id;

      if (!id) {
        return;
      }

      selectedOnceRef.current = true;
      const addressFull =
        ((detail?.address as { full_address?: string } | undefined)?.full_address ??
          (detail?.full_address as string | undefined));

      debugLog('YaNddWidgetPointSelected', {
        id,
        addressFull,
        keys: detail ? Object.keys(detail) : []
      });

      onSelectRef.current({
        pvzId: String(id),
        addressFull,
        raw: detail
      });
      onCloseRef.current();
    };

    document.addEventListener('YaNddWidgetPointSelected', onPointSelected as EventListener);

    const tryStartWhenWide = (startTs: number) => {
      if (cancelled || widthResolved) {
        return;
      }

      const width = container.getBoundingClientRect().width;
      const elapsed = performance.now() - startTs;
      if (width >= 900 || elapsed > 2500) {
        widthResolved = true;

        if (window.YaDelivery?.createWidget) {
          debugLog('script found on window, starting widget', { width, elapsed });
          startWidget();
        } else {
          debugLog('waiting for YaNddWidgetLoad before start', { width, elapsed });
          document.addEventListener('YaNddWidgetLoad', startWidget, { once: true });
        }

        return;
      }

      rafId = requestAnimationFrame(() => tryStartWhenWide(startTs));
    };

    rafId = requestAnimationFrame(() => tryStartWhenWide(performance.now()));

    timeoutId = window.setTimeout(() => {
      if (cancelled || widthResolved) {
        return;
      }
      widthResolved = true;

      if (window.YaDelivery?.createWidget) {
        debugLog('timeout fallback start');
        startWidget();
      } else {
        debugLog('timeout fallback waiting YaNddWidgetLoad');
        document.addEventListener('YaNddWidgetLoad', startWidget, { once: true });
      }
    }, 3000);

    return () => {
      cancelled = true;
      selectedOnceRef.current = false;
      document.removeEventListener('YaNddWidgetPointSelected', onPointSelected as EventListener);
      document.removeEventListener('YaNddWidgetLoad', startWidget);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      container.innerHTML = '';
    };
  }, [city, isOpen, physical_dims_weight_gross, source_platform_station]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <span>Выберите пункт выдачи</span>
          <button className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className={styles.body}>
          {error ? <div className={styles.error}>{error}</div> : null}
          <div
            id={containerIdRef.current}
            ref={containerRef}
            className={styles.widget}
            aria-hidden={Boolean(error)}
          />
        </div>
      </div>
    </div>
  );
}

export { YaPvzPickerModal as YaNddPvzModal };
