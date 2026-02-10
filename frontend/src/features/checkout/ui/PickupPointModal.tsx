import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../../../shared/ui/Modal';
import { Button } from '../../../shared/ui/Button';
import type { PickupProvider } from '../api/checkoutApi';
import { PickupMap } from './PickupMap';
import styles from './PickupPointModal.module.css';
import { useModalFocus } from '../../../shared/lib/useModalFocus';
import { usePickupPoints } from '../hooks/usePickupPoints';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedId?: string;
  onConfirm: (payload: { pickupPointId: string; provider: PickupProvider }) => Promise<void>;
};

export const PickupPointModal = ({ isOpen, onClose, selectedId, onConfirm }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, onClose, ref);

  const [currentId, setCurrentId] = useState<string | undefined>(selectedId);
  const { points, center, isLoading, error, abort } = usePickupPoints({ isOpen, radiusKm: 10 });

  useEffect(() => {
    if (!isOpen) {
      abort();
    }
  }, [abort, isOpen]);

  useEffect(() => {
    setCurrentId(selectedId);
  }, [selectedId, isOpen]);

  const selectedPoint = useMemo(
    () => points.find((point) => point.id === currentId),
    [currentId, points]
  );

  const handleClose = () => {
    abort();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} role="dialog" aria-modal="true" className={styles.modal}>
      <div ref={ref} className={styles.content}>
        <header>
          <h3 className={styles.title}>Пункт выдачи</h3>
          <p className={styles.subtitle}>Нажмите на метку на карте, чтобы выбрать пункт</p>
        </header>

        <div className={styles.status}>
          {selectedPoint ? `Выбран пункт: ${selectedPoint.address}` : 'Пункт не выбран'}
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <PickupMap
          points={points}
          selectedId={currentId}
          center={center}
          isLoading={isLoading}
          onSelect={setCurrentId}
        />

        <footer className={styles.footer}>
          <Button variant="ghost" onClick={handleClose}>Отмена</Button>
          <Button
            disabled={!selectedPoint}
            onClick={() => selectedPoint && void onConfirm({ pickupPointId: selectedPoint.id, provider: selectedPoint.provider }).then(handleClose)}
          >
            Выбрать
          </Button>
        </footer>
      </div>
    </Modal>
  );
};
