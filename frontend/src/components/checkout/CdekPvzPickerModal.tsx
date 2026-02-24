import { useEffect, useRef } from 'react';
import styles from '../../shared/ui/address/AddressModal.module.css';

declare global {
  interface Window {
    CDEKWidget: new (config: Record<string, unknown>) => unknown;
  }
}

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

export function CdekPvzPickerModal({
  isOpen,
  onClose,
  onSelect,
  city = 'Москва'
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

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

    const timer = window.setTimeout(() => {
      if (!window.CDEKWidget) {
        console.error('[CdekPvzPickerModal] CDEKWidget не загружен');
        return;
      }

      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';

      new window.CDEKWidget({
        from: city,
        root: containerRef.current,
        apiKey: '',
        servicePath: `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/cdek/service`,
        defaultLocation: city,
        hideDeliveryOptions: {
          door: true
        },
        onReady: () => {
          console.info('[CdekPvzPickerModal] widget ready');
        },
        onChoose: (
          _type: string,
          _tariff: unknown,
          address: Record<string, unknown>
        ) => {
          const location = address.location && typeof address.location === 'object' ? address.location as Record<string, unknown> : null;
          const cityCode = Number(address.city_code ?? address.cityCode ?? location?.city_code ?? 0);
          const latitude = Number(address.latitude ?? location?.latitude ?? 0);
          const longitude = Number(address.longitude ?? location?.longitude ?? 0);
          onSelect({
            pvzCode: String(address.code ?? ''),
            addressFull: String(address.address_full ?? address.address ?? ''),
            cityName: String(address.city ?? ''),
            cityCode: Number.isFinite(cityCode) ? cityCode : undefined,
            latitude: Number.isFinite(latitude) ? latitude : undefined,
            longitude: Number.isFinite(longitude) ? longitude : undefined,
            workTime: typeof address.work_time === 'string' ? address.work_time : undefined,
            raw: address
          });
          onClose();
        }
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen, city, onSelect, onClose]);

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
        <div style={{ height: '600px', overflow: 'hidden' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}
