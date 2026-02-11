import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../shared/ui/Modal';
import type { DeliveryProvider, PickupPoint } from '../api/checkoutApi';
import styles from './PickupPointModal.module.css';
import { useModalFocus } from '../../../shared/lib/useModalFocus';
import { DeliveryPickupWidget } from './DeliveryPickupWidget';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedPoint?: PickupPoint | null;
  onConfirm: (payload: { pickupPoint: PickupPoint; provider: DeliveryProvider }) => Promise<void>;
};

export const PickupPointModal = ({ isOpen, onClose, selectedPoint, onConfirm }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, onClose, ref);
  const [point, setPoint] = useState<PickupPoint | null>(selectedPoint ?? null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPoint(selectedPoint ?? null);
      setIsSaving(false);
    }
  }, [isOpen, selectedPoint]);

  const handlePointSelected = (selected: PickupPoint) => {
    setPoint(selected);
    setIsSaving(true);
    void onConfirm({ pickupPoint: selected, provider: 'yandex_delivery' })
      .then(() => onClose())
      .finally(() => setIsSaving(false));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} role="dialog" aria-modal="true" className={styles.modal}>
      <div ref={ref} className={styles.content}>
        <header>
          <h3 className={styles.title}>Пункт выдачи</h3>
          <p className={styles.subtitle}>Выберите пункт на карте или в списке</p>
        </header>

        <div className={styles.status}>
          {isSaving
            ? 'Сохраняем выбранный ПВЗ…'
            : point
              ? `Выбран пункт: ${point.fullAddress}`
              : 'Пункт не выбран'}
        </div>

        <DeliveryPickupWidget isOpen={isOpen} selectedPoint={point} onSelected={handlePointSelected} />
      </div>
    </Modal>
  );
};
