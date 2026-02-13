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

  // Город можно менять
  city?: string;

  // Станция отгрузки продавца (GUID). Нужна для маршрутов/доступности точек.
  sourcePlatformStationId?: string;

  // Вес (в граммах), если нужно фильтровать точки по допустимому весу
  weightGrossG?: number;

  // Хочешь постаматы тоже? тогда includeTerminals=true
  includeTerminals?: boolean;

  // Фильтр методов оплаты (можно выключить, передав undefined/[])
  paymentMethods?: Array<'already_paid' | 'cash_on_receipt' | 'card_on_receipt'>;
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
  paymentMethods = ['already_paid', 'card_on_receipt']
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
    onSelectRef.current = onSelect;
  }, [onClose, onSelect]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    document.body.appendChild(portalRoot);
    return () => portalRoot.remove();
  }, [portalRoot]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const onPointSelected = (evt: Event) => {
      const d = (evt as CustomEvent)?.detail as any;
      if (!d?.id) return;

      onSelectRef.current({
        pvzId: String(d.id),
        addressFull: d?.address?.full_address,
        raw: d
      });

      onCloseRef.current();
    };

    const init = async () => {
      setLoading(true);
      setError('');

      try {
        await ensureYaNddWidgetLoaded();
        if (cancelled) return;

        const yaDelivery = (window as any)?.YaDelivery;
        const createWidget = yaDelivery?.createWidget;

        if (typeof createWidget !== 'function') {
          throw new Error(
            'YaDelivery.createWidget недоступен. Скрипт виджета не загрузился или заблокирован.'
          );
        }

        if (!sourcePlatformStationId) {
          console.warn(
            '[YaNddPvzModal] sourcePlatformStationId is missing. Widget may show incomplete results.'
          );
        }

        // 1) Подписка на выбор точки
        document.addEventListener('YaNddWidgetPointSelected', onPointSelected);

        // 2) Рендер виджета
        const container = document.getElementById(containerId);
        if (!container) {
          // если контейнера нет (редко, но бывает) - снимем слушатель
          document.removeEventListener('YaNddWidgetPointSelected', onPointSelected);
          return;
        }

        // Иногда повторная инициализация в тот же контейнер ломает UI
        container.innerHTML = '';

        const filterType = includeTerminals
          ? ['pickup_point', 'terminal']
          : ['pickup_point'];

        const widgetParams: any = {
          city,
          size: { width: '100%', height: '100%' },
          show_select_button: true,

          // Вес товара (фильтрация доступных точек)
          physical_dims_weight_gross: weightGrossG,

          // Станция отгрузки продавца (если есть)
          ...(sourcePlatformStationId
            ? { source_platform_station: sourcePlatformStationId }
            : {}),

          filter: {
            type: filterType,
            is_yandex_branded: false
          }
        };

        // Фильтр оплаты включаем только если реально передали методы (и не пусто)
        if (paymentMethods && paymentMethods.length > 0) {
          widgetParams.filter.payment_methods = paymentMethods;
          widgetParams.filter.payment_methods_filter = 'or';
        }

        createWidget({
          containerId,
          params: widgetParams
        });
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Ошибка инициализации виджета ПВЗ');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
      document.removeEventListener('YaNddWidgetPointSelected', onPointSelected);
    };
  }, [
    isOpen,
    city,
    containerId,
    sourcePlatformStationId,
    weightGrossG,
    includeTerminals,
    paymentMethods
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
