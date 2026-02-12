import { useEffect, useMemo, useRef } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { ensureYaNddWidgetLoaded } from '../../shared/lib/yaNddWidget';

export type YaPvzSelection = {
  pvzId: string;
  addressFull?: string;
  raw?: unknown;
};

type YaPvzPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sel: YaPvzSelection) => void;
  title?: string;
  city?: string;
  widgetParams?: Record<string, unknown>;
};

const DEFAULT_WIDGET_PARAMS: Record<string, unknown> = {
  city: 'Москва',
  size: { width: '100%', height: '420px' },
  show_select_button: true,
  filter: {
    type: ['pickup_point', 'terminal'],
    is_yandex_branded: false,
    payment_methods: ['already_paid', 'card_on_receipt'],
    payment_methods_filter: 'or'
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepMerge = (base: Record<string, unknown>, override: Record<string, unknown>) => {
  const result: Record<string, unknown> = { ...base };

  Object.entries(override).forEach(([key, value]) => {
    if (isObject(value) && isObject(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value);
      return;
    }
    result[key] = value;
  });

  return result;
};

export const YaPvzPickerModal = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Выбор ПВЗ',
  city,
  widgetParams
}: YaPvzPickerModalProps) => {
  const containerId = useMemo(() => `ya-pvz-picker-${Math.random().toString(16).slice(2)}`, []);
  const createdForCurrentOpenRef = useRef(false);

  const mergedParams = useMemo(() => {
    const base = deepMerge(DEFAULT_WIDGET_PARAMS, {
      city: city ?? 'Москва'
    });

    return widgetParams ? deepMerge(base, widgetParams) : base;
  }, [city, widgetParams]);

  useEffect(() => {
    if (!isOpen) {
      createdForCurrentOpenRef.current = false;
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
      return;
    }

    let isCancelled = false;

    const handlePointSelected = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown> | undefined>).detail;
      if (!detail?.id) {
        return;
      }

      const address = isObject(detail.address) ? detail.address : undefined;

      onSelect({
        pvzId: String(detail.id),
        addressFull: typeof address?.full_address === 'string' ? address.full_address : undefined,
        raw: detail
      });
      onClose();
    };

    const initWidget = async () => {
      await ensureYaNddWidgetLoaded();

      if (isCancelled || createdForCurrentOpenRef.current) {
        return;
      }

      window.YaDelivery?.createWidget({
        containerId,
        params: mergedParams
      });
      createdForCurrentOpenRef.current = true;
    };

    document.addEventListener('YaNddWidgetPointSelected', handlePointSelected);
    void initWidget();

    return () => {
      isCancelled = true;
      document.removeEventListener('YaNddWidgetPointSelected', handlePointSelected);
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [containerId, isOpen, mergedParams, onClose, onSelect]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} role="dialog" aria-modal="true">
      <div>
        <h3>{title}</h3>
        <div id={containerId} />
      </div>
    </Modal>
  );
};

export type { YaPvzPickerModalProps };
