import { useEffect, useRef } from 'react';
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
  source_platform_station: string;        // по доке, обязательный если считаем доставку
  physical_dims_weight_gross?: number;    // по доке, граммы
};

declare global {
  interface Window {
    YaDelivery?: {
      createWidget: (args: { containerId: string; params: any }) => void;
    };
  }
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
  const mountedRef = useRef(false);

  // 1) Подписка на событие выбора (строго по доке)
  useEffect(() => {
    const handler = (data: any) => {
      const d = data?.detail;
      if (!d?.id) return;

      onSelect({
        pvzId: String(d.id),
        addressFull: d?.address?.full_address,
        raw: d
      });

      onClose();
    };

    document.addEventListener('YaNddWidgetPointSelected', handler);
    return () => document.removeEventListener('YaNddWidgetPointSelected', handler);
  }, [onClose, onSelect]);

  // 2) Создание виджета (строго по доке)
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

    function startWidget() {
      if (cancelled) return;
      if (!window.YaDelivery?.createWidget) return;

      window.YaDelivery.createWidget({
        containerId: containerIdRef.current,
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
    }

    // ВАЖНО: ждём нормальную ширину контейнера до старта,
    // иначе виджет стартует в "мобильном" режиме (1 колонка).
    async function startWhenWide() {
      const el = document.getElementById(containerIdRef.current);
      if (!el) return;

      const start = performance.now();
      while (!cancelled) {
        const w = el.getBoundingClientRect().width;
        // порог можно чуть менять, но 900 обычно достаточно для desktop-layout
        if (w >= 900) break;
        if (performance.now() - start > 2500) break; // не зависаем вечно
        await new Promise((r) => requestAnimationFrame(r));
      }

      // запускаем строго как в доке
      if (window.YaDelivery) startWidget();
      else document.addEventListener('YaNddWidgetLoad', startWidget, { once: true });
    }

    // чистим контейнер перед стартом (чтобы рестарт был чистым)
    const el = document.getElementById(containerIdRef.current);
    if (el) el.innerHTML = '';

    startWhenWide();

    return () => {
      cancelled = true;
      document.removeEventListener('YaNddWidgetPointSelected', onPointSelected);
      document.removeEventListener('YaNddWidgetLoad', startWidget);
      container.innerHTML = '';
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
          <div id={containerIdRef.current} className={styles.widget} />
        </div>
      </div>
    </div>
  );
}
