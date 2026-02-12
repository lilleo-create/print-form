import { useEffect, useMemo } from 'react';
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
  city?: string; // optional, default Москва
};

export const YaPvzPickerModal = ({ isOpen, onClose, onSelect, city = 'Москва' }: Props) => {
  const containerId = useMemo(() => `delivery-widget-${Math.random().toString(16).slice(2)}`, []);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const onPointSelected = (ev: any) => {
      const d = ev?.detail;
      if (!d?.id) return;

      onSelect({
        pvzId: String(d.id),
        addressFull: d?.address?.full_address,
        raw: d
      });
      onClose();
    };

    const run = async () => {
      await ensureYaNddWidgetLoaded();
      if (cancelled) return;

      document.addEventListener('YaNddWidgetPointSelected', onPointSelected);

      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = '';

      window.YaDelivery!.createWidget({
        containerId,
        params: {
          city, // ВАЖНО: по доке
          size: { width: '100%', height: '420px' },
          show_select_button: true,
          filter: {
            type: ['pickup_point', 'terminal'], // ВАЖНО: по доке
            is_yandex_branded: false,
            payment_methods: ['already_paid', 'card_on_receipt'],
            payment_methods_filter: 'or'
          }
        }
      });
    };

    run().catch((e) => console.error('[YaPvzPickerModal] init error', e));

    return () => {
      cancelled = true;
      document.removeEventListener('YaNddWidgetPointSelected', onPointSelected);
      const el = document.getElementById(containerId);
      if (el) el.innerHTML = '';
    };
  }, [isOpen, containerId, onClose, onSelect, city]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 820,
          maxWidth: '95vw',
          background: '#fff',
          borderRadius: 16,
          padding: 16
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div id={containerId} style={{ width: '100%', height: 420 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};
