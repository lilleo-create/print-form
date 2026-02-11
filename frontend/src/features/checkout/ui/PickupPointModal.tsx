import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../shared/ui/Modal';
import { Button } from '../../../shared/ui/Button';
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

  useEffect(() => {
    if (isOpen) {
      setPoint(selectedPoint ?? null);
    }
  }, [isOpen, selectedPoint]);

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} role="dialog" aria-modal="true" className={styles.modal}>
      <div ref={ref} className={styles.content}>
        <header>
          <h3 className={styles.title}>Пункт выдачи</h3>
          <p className={styles.subtitle}>Выберите пункт на карте виджета</p>
        </header>

        <div className={styles.status}>
          {point ? `Выбран пункт: ${point.fullAddress}` : 'Пункт не выбран'}
        </div>

        <DeliveryPickupWidget onSelected={setPoint} />

        <footer className={styles.footer}>
          <Button variant="ghost" onClick={handleClose}>Отмена</Button>
          <Button
            disabled={!point}
            onClick={() => point && void onConfirm({ pickupPoint: point, provider: 'yandex_delivery' }).then(handleClose)}
          >
            Выбрать
          </Button>
        </footer>
      </div>
    </Modal>
  );
};
