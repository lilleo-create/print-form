import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureYaNddWidgetLoaded } from '../../shared/lib/yaNddWidget';
import styles from './YaPvzPickerModal.module.css';

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
};

const DESKTOP_WIDTH_THRESHOLD = 900;
const SIZE_WAIT_TIMEOUT_MS = 3000;

const isDev = import.meta.env.DEV;

const debugLog = (...args: unknown[]) => {
  if (isDev) {
    console.debug('[YaPvzPickerModal]', ...args);
  }
};

const waitRaf = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const waitForContainerWidth = async (
  element: HTMLElement,
  timeoutMs: number
): Promise<{ rect: DOMRect; timedOut: boolean }> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await waitRaf();
    const rect = element.getBoundingClientRect();
    if (rect.width >= DESKTOP_WIDTH_THRESHOLD) {
      return { rect, timedOut: false };
    }
  }

  return { rect: element.getBoundingClientRect(), timedOut: true };
};

export const YaPvzPickerModal = ({
  isOpen,
  onClose,
  onSelect,
  city = 'Москва',
  source_platform_station,
  physical_dims_weight_gross = 10000
}: Props) => {
  const containerId = useMemo(
    () => `ya-ndd-widget-${Math.random().toString(16).slice(2)}`,
    []
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const onCloseRef = useRef(onClose);
  const selectedRef = useRef(false);
  const bodyStyleRef = useRef<{
    overflow: string;
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
  } | null>(null);
  const scrollYRef = useRef(0);
  const [error, setError] = useState<string | null>(null);

  onSelectRef.current = onSelect;
  onCloseRef.current = onClose;

  useEffect(() => {
    const body = document.body;

    if (isOpen) {
      if (!bodyStyleRef.current) {
        bodyStyleRef.current = {
          overflow: body.style.overflow,
          position: body.style.position,
          top: body.style.top,
          left: body.style.left,
          right: body.style.right,
          width: body.style.width
        };
      }
      scrollYRef.current = window.scrollY;

      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${scrollYRef.current}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';

      return;
    }

    if (bodyStyleRef.current) {
      const prev = bodyStyleRef.current;
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollYRef.current);
      bodyStyleRef.current = null;
    }

    return () => {
      if (!bodyStyleRef.current) return;
      const prev = bodyStyleRef.current;
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      bodyStyleRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

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
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) {
      setError('Не удалось подготовить контейнер виджета ПВЗ.');
      return;
    }

    selectedRef.current = false;
    setError(null);
    container.innerHTML = '';

    if (!source_platform_station?.trim()) {
      setError('Не задан source_platform_station. Укажите станцию отгрузки продавца.');
      return;
    }

    let cancelled = false;

    const onPointSelected = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      debugLog('YaNddWidgetPointSelected', detail);

      if (selectedRef.current || !detail?.id) {
        return;
      }

      selectedRef.current = true;
      onSelectRef.current({
        pvzId: String(detail.id),
        addressFull: detail?.address?.full_address,
        raw: detail
      });
      onCloseRef.current();
    };

    const startWidget = async () => {
      if (cancelled) return;

      try {
        await ensureYaNddWidgetLoaded();
        if (cancelled) return;

        if (!window.YaDelivery?.createWidget) {
          throw new Error('YA_NDD_WIDGET_NOT_LOADED');
        }

        const widthResult = await waitForContainerWidth(
          container,
          SIZE_WAIT_TIMEOUT_MS
        );

        if (cancelled) return;

        if (widthResult.timedOut) {
          debugLog(
            `Container width below ${DESKTOP_WIDTH_THRESHOLD}px, starting anyway`,
            widthResult.rect.width
          );
        }

        const params = {
          city,
          size: {
            width: `${Math.max(320, Math.floor(widthResult.rect.width))}px`,
            height: '780px'
          },
          show_select_button: true,
          source_platform_station,
          physical_dims_weight_gross
        };

        debugLog('createWidget', { containerId, params });

        container.innerHTML = '';
        window.YaDelivery.createWidget({ containerId, params });
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : 'Не удалось инициализировать виджет ПВЗ';
        console.error('[YaPvzPickerModal]', message, e);
        setError(
          'Не удалось загрузить карту ПВЗ. Обновите страницу и попробуйте снова.'
        );
      }
    };

    document.addEventListener('YaNddWidgetPointSelected', onPointSelected);

    if (window.YaDelivery?.createWidget) {
      debugLog('script already loaded');
      void startWidget();
    } else {
      debugLog('waiting for YaNddWidgetLoad');
      document.addEventListener('YaNddWidgetLoad', startWidget, { once: true });
      void ensureYaNddWidgetLoaded().catch(() => {
        // error will be surfaced in startWidget when event arrives, or by loader.
      });
    }

    return () => {
      cancelled = true;
      document.removeEventListener('YaNddWidgetPointSelected', onPointSelected);
      document.removeEventListener('YaNddWidgetLoad', startWidget);
      container.innerHTML = '';
    };
  }, [
    city,
    containerId,
    isOpen,
    physical_dims_weight_gross,
    source_platform_station
  ]);

  return (
    <div
      className={`${styles.overlay} ${isOpen ? styles.overlayOpen : styles.overlayClosed}`}
      onClick={() => onCloseRef.current()}
      aria-hidden={!isOpen}
    >
      <div
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Выбор пункта выдачи"
      >
        <div className={styles.header}>
          <h3 className={styles.title}>Выберите пункт выдачи</h3>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => onCloseRef.current()}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          <div ref={containerRef} id={containerId} className={styles.widgetMount} />
          {error ? <div className={styles.error}>{error}</div> : null}
        </div>
      </div>
    </div>
  );
};

export { YaPvzPickerModal as YaNddPvzModal };
