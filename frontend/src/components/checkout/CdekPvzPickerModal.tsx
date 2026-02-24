import { useEffect, useMemo, useState } from 'react';
import styles from '../../shared/ui/address/AddressModal.module.css';

export type CdekPvzSelection = {
  pvzCode: string;
  addressFull: string;
  cityName?: string;
  cityCode?: number;
  latitude?: number;
  longitude?: number;
  workTime?: string;
  raw?: unknown;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sel: CdekPvzSelection) => void;
  city?: string;
};

type CdekWidgetMessage =
  | {
      type: 'CDEK_PVZ_SELECTED';
      payload: CdekPvzSelection;
    }
  | {
      type: 'CDEK_WIDGET_STATUS';
      payload: { ok: boolean; reason?: string };
    };

export function CdekPvzPickerModal({
  isOpen,
  onClose,
  onSelect,
  city = 'Москва'
}: Props) {
  const [widgetStatus, setWidgetStatus] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [iframeToken, setIframeToken] = useState(0);

  const iframeSrc = useMemo(() => `/cdek-widget?city=${encodeURIComponent(city)}`, [city]);

  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const messageHandler = (event: MessageEvent<CdekWidgetMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'CDEK_WIDGET_STATUS') {
        setWidgetStatus(event.data.payload);
        return;
      }

      if (event.data.type === 'CDEK_PVZ_SELECTED') {
        onSelect(event.data.payload);
        onClose();
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [isOpen, onClose, onSelect]);

  useEffect(() => {
    if (!isOpen) {
      setWidgetStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        style={{ maxWidth: '900px', width: '95vw' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h3>Выберите пункт выдачи СДЭК</h3>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        {!widgetStatus?.ok && widgetStatus?.reason ? (
          <div style={{ marginBottom: '0.75rem', color: '#b42318' }}>
            Виджет не загрузился: {widgetStatus.reason}
            <button
              type="button"
              onClick={() => {
                setWidgetStatus(null);
                setIframeToken((value) => value + 1);
              }}
              style={{ marginLeft: '0.75rem' }}
            >
              Повторить
            </button>
          </div>
        ) : null}
        <iframe
          key={iframeToken}
          title="Выбор пункта выдачи CDEK"
          src={iframeSrc}
          style={{
            width: '100%',
            height: '70vh',
            minHeight: '520px',
            border: 0,
            borderRadius: 'var(--radius-card)'
          }}
        />
      </div>
    </div>
  );
}
