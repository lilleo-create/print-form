import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  sourcePlatformStationId?: string;
  weightGrossG?: number;
  includeTerminals?: boolean;
};

const DESKTOP_MIN_SIZE = { width: 900, height: 600 };
const MOBILE_MIN_SIZE = { width: 320, height: 460 };
const SIZE_WAIT_TIMEOUT_MS = 2000;

const waitRaf = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const waitForContainerSize = async (
  element: HTMLElement,
  timeoutMs: number
): Promise<DOMRect> => {
  const startedAt = Date.now();
  const minSize =
    window.matchMedia('(max-width: 768px)').matches ||
    window.innerWidth < DESKTOP_MIN_SIZE.width
      ? MOBILE_MIN_SIZE
      : DESKTOP_MIN_SIZE;

  while (Date.now() - startedAt < timeoutMs) {
    await waitRaf();
    await waitRaf();
    const rect = element.getBoundingClientRect();
    if (rect.width >= minSize.width && rect.height >= minSize.height) {
      return rect;
    }
  }

  throw new Error(
    `YA_NDD_WIDGET_CONTAINER_SIZE_INVALID: expected >=${minSize.width}x${minSize.height}`
  );
};

export const YaNddPvzModal = ({
  isOpen,
  onClose,
  onSelect,
  city = 'Москва',
  sourcePlatformStationId,
  weightGrossG = 10000,
  includeTerminals = true
}: Props) => {
  const containerId = useMemo(
    () => `ya-ndd-widget-${Math.random().toString(16).slice(2)}`,
    []
  );
  const widgetCreatedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bodyStyleRef = useRef<{
    overflow: string;
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
  } | null>(null);
  const scrollYRef = useRef(0);
  const paramsRef = useRef<Record<string, unknown>>({});
  const onSelectRef = useRef(onSelect);
  const onCloseRef = useRef(onClose);
  const [error, setError] = useState<string | null>(null);

  onSelectRef.current = onSelect;
  onCloseRef.current = onClose;

  const buildParams = useCallback(
    (size: { width: string; height: string }) => ({
      city,
      size,
      show_select_button: true,
      source_platform_station_id: sourcePlatformStationId,
      weight_gross: weightGrossG,
      filter: {
        type: includeTerminals ? ['pickup_point', 'terminal'] : ['pickup_point']
      }
    }),
    [city, includeTerminals, sourcePlatformStationId, weightGrossG]
  );

  useEffect(() => {
    const onPointSelected = (ev: Event) => {
      const d = (ev as CustomEvent)?.detail;
      if (!d?.id) return;

      onSelectRef.current({
        pvzId: String(d.id),
        addressFull: d?.address?.full_address,
        raw: d
      });
      onCloseRef.current();
    };

    document.addEventListener('YaNddWidgetPointSelected', onPointSelected);

    return () => {
      document.removeEventListener('YaNddWidgetPointSelected', onPointSelected);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

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

    let cancelled = false;

    const initOrUpdateWidget = async () => {
      setError(null);

      try {
        await ensureYaNddWidgetLoaded();

        if (!window.YaDelivery?.createWidget) {
          throw new Error('YA_NDD_WIDGET_NOT_LOADED');
        }

        const container = containerRef.current;
        if (!container) {
          throw new Error('YA_NDD_WIDGET_CONTAINER_NOT_FOUND');
        }

        const rect = await waitForContainerSize(container, SIZE_WAIT_TIMEOUT_MS);
        if (cancelled) return;

        const size = {
          width: `${Math.floor(rect.width)}px`,
          height: `${Math.floor(rect.height)}px`
        };
        const params = buildParams(size);
        paramsRef.current = params;

        if (!widgetCreatedRef.current) {
          window.YaDelivery.createWidget({ containerId, params });
          widgetCreatedRef.current = true;
        } else {
          window.YaDelivery.setParams?.(params);
          window.dispatchEvent(new Event('resize'));
        }
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : 'Не удалось инициализировать виджет ПВЗ';
        console.error('[YaNddPvzModal]', message, e);
        setError(
          'Не удалось загрузить карту ПВЗ. Обновите страницу и попробуйте снова.'
        );
      }
    };

    void initOrUpdateWidget();

    return () => {
      cancelled = true;
    };
  }, [buildParams, containerId, isOpen]);

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

export const YaPvzPickerModal = YaNddPvzModal;
