import { useEffect, useMemo } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { loadScriptOnce } from '../../shared/lib/loadScriptOnce';

type YaPvzSelection = {
  provider: 'YANDEX_NDD';
  pvzId: string;
  addressFull?: string;
  country?: string;
  locality?: string;
  street?: string;
  house?: string;
  comment?: string;
  raw: unknown;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (value: YaPvzSelection) => void;
  params?: Record<string, unknown>;
  containerIdPrefix: string;
};

declare global {
  interface Window {
    YaDelivery?: {
      createWidget: (params: { containerId: string; params: Record<string, unknown> }) => void;
    };
  }
}

const SCRIPT_URL = 'https://ndd-widget.landpro.site/widget.js';

export const YaPvzPickerModal = ({ isOpen, onClose, onSelect, params, containerIdPrefix }: Props) => {
  const containerId = useMemo(() => `${containerIdPrefix}-${Math.random().toString(16).slice(2)}`, [containerIdPrefix]);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const onPoint = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (!detail) return;
      onSelect({
        provider: 'YANDEX_NDD',
        pvzId: String(detail.id ?? ''),
        addressFull: String(((detail.address as Record<string, unknown> | undefined)?.full_address as string | undefined) ?? ''),
        country: (detail.address as Record<string, unknown> | undefined)?.country as string | undefined,
        locality: (detail.address as Record<string, unknown> | undefined)?.locality as string | undefined,
        street: (detail.address as Record<string, unknown> | undefined)?.street as string | undefined,
        house: (detail.address as Record<string, unknown> | undefined)?.house as string | undefined,
        comment: (detail.address as Record<string, unknown> | undefined)?.comment as string | undefined,
        raw: detail
      });
      onClose();
    };

    document.addEventListener('YaNddWidgetPointSelected', onPoint);
    void loadScriptOnce(SCRIPT_URL).then(() => {
      if (!mounted || !window.YaDelivery) return;
      window.YaDelivery.createWidget({ containerId, params: params ?? {} });
    });

    return () => {
      mounted = false;
      document.removeEventListener('YaNddWidgetPointSelected', onPoint);
    };
  }, [isOpen, onClose, onSelect, params, containerId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} role="dialog" aria-modal="true">
      <div>
        <h3>Выбор ПВЗ</h3>
        <div id={containerId} style={{ minHeight: 500 }} />
      </div>
    </Modal>
  );
};

export type { YaPvzSelection };
