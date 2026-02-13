import { useEffect, useRef } from 'react';
import styles from './YaPvzPickerModal.module.css';
import { ensureYaNddWidgetLoaded } from '../../shared/lib/yaNddWidget';

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


export function YaPvzPickerModal({
  isOpen,
  onClose,
  onSelect,
  city = 'Москва',
  source_platform_station,
  physical_dims_weight_gross = 10000
}: Props) {
  const containerIdRef = useRef(`delivery-widget-${Math.random().toString(16).slice(2)}`);
  const onSelectRef = useRef(onSelect);
  const onCloseRef = useRef(onClose);
  const selectedPointIdRef = useRef<string | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // 1) Подписка на событие выбора (строго по доке)
  useEffect(() => {
    if (!isOpen) return;

    const handler = (event: Event) => {
      const d = (event as CustomEvent<{ id?: string; address?: { full_address?: string } }>).detail;
      if (!d?.id) return;

      const selectedId = String(d.id);
      if (selectedPointIdRef.current === selectedId) return;
      selectedPointIdRef.current = selectedId;

      if (import.meta.env.DEV) {
        console.debug('[YaPvzPickerModal] YaNddWidgetPointSelected', {
          id: selectedId,
          full_address: d?.address?.full_address,
          keys: Object.keys(d ?? {})
        });
      }

      onSelectRef.current({
        pvzId: selectedId,
        addressFull: d?.address?.full_address,
        raw: d
      });

      onCloseRef.current();
    };

    document.addEventListener('YaNddWidgetPointSelected', handler);
    return () => {
      document.removeEventListener('YaNddWidgetPointSelected', handler);
      selectedPointIdRef.current = null;
    };
  }, [isOpen]);

  // 2) Создание виджета (строго по доке)
  useEffect(() => {
    if (!isOpen) return;
    if (!source_platform_station?.trim()) return;

    const containerId = containerIdRef.current;
    let cancelled = false;
    let raf = 0;
    let timeout = 0;
    let startRequested = false;
    let waitingForLoad = false;

    const startWidget = () => {
      if (cancelled || startRequested) return;
      if (!window.YaDelivery?.createWidget) return;
      startRequested = true;

      if (import.meta.env.DEV) {
        console.debug('[YaPvzPickerModal] createWidget', {
          containerId,
          city,
          source_platform_station,
          physical_dims_weight_gross
        });
      }

      window.YaDelivery.createWidget({
        containerId,
        params: {
          city,
          size: {
            height: '780px', // дока: только px
            width: '100%'    // дока: % или px
          },
          source_platform_station,
          physical_dims_weight_gross,
          delivery_price: 'от 100',
          delivery_term: 'от 1 дня',
          show_select_button: true,
          filter: {
            type: ['pickup_point', 'terminal'],
            is_yandex_branded: false,
            payment_methods: ['already_paid', 'card_on_receipt'],
            payment_methods_filter: 'or'
          }
        }
      });
    };

    const onWidgetLoad = () => {
      if (cancelled) return;
      if (import.meta.env.DEV) {
        console.debug('[YaPvzPickerModal] script loaded via YaNddWidgetLoad');
      }
      startWidget();
    };

    const waitForWidthAndStart = () => {
      const el = document.getElementById(containerId);
      if (!el) return;

      const start = performance.now();
      const tick = () => {
        if (cancelled) return;
        const w = el.getBoundingClientRect().width;
        if (w >= 900 || performance.now() - start > 2500) {
          if (window.YaDelivery?.createWidget) {
            if (import.meta.env.DEV) {
              console.debug('[YaPvzPickerModal] script already available');
            }
            startWidget();
            return;
          }

          waitingForLoad = true;
          document.addEventListener('YaNddWidgetLoad', onWidgetLoad, {
            once: true
          });
          void ensureYaNddWidgetLoaded().catch((error) => {
            if (import.meta.env.DEV) {
              console.debug('[YaPvzPickerModal] script load failed', error);
            }
          });
          return;
        }
        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
      timeout = window.setTimeout(() => {
        if (cancelled || startRequested) return;
        if (window.YaDelivery?.createWidget) startWidget();
      }, 3000);
    };

    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';

    waitForWidthAndStart();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (timeout) clearTimeout(timeout);
      if (waitingForLoad) {
        document.removeEventListener('YaNddWidgetLoad', onWidgetLoad);
      }
      const container = document.getElementById(containerId);
      if (container) container.innerHTML = '';
    };
  }, [isOpen, city, source_platform_station, physical_dims_weight_gross]);

  // 3) Не рендерим ничего, если закрыто
  if (!isOpen) return null;

  // 4) Модалка
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
          {!source_platform_station?.trim() ? (
            <div className={styles.notice}>
              Не задан source_platform_station. Укажите станцию отгрузки, чтобы
              открыть карту ПВЗ.
            </div>
          ) : (
            <div id={containerIdRef.current} className={styles.widget} />
          )}
        </div>
      </div>
    </div>
  );
}

export { YaPvzPickerModal as YaNddPvzModal };
