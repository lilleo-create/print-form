import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../shared/ui/Modal';
import { Button } from '../../../shared/ui/Button';
import type { PickupPointDto, PickupProvider } from '../api/checkoutApi';
import { PickupMap } from './PickupMap';
import styles from './PickupPointModal.module.css';
import { useModalFocus } from '../../../shared/lib/useModalFocus';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  points: PickupPointDto[];
  selectedId?: string;
  onFilter: (provider?: PickupProvider) => void;
  onConfirm: (point: PickupPointDto) => Promise<void>;
};

export const PickupPointModal = ({ isOpen, onClose, points, selectedId, onFilter, onConfirm }: Props) => {
  const [currentId, setCurrentId] = useState<string | undefined>(selectedId);
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, onClose, ref);

  useEffect(() => setCurrentId(selectedId), [selectedId]);

  const selected = points.find((point) => point.id === currentId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} role="dialog" aria-modal="true" className={styles.modal}>
      <div ref={ref} className={styles.content}>
        <h3>Пункты выдачи</h3>
        <div className={styles.filters}>
          <button type="button" onClick={() => onFilter()}>Все</button>
          <button type="button" onClick={() => onFilter('CDEK')}>CDEK</button>
          <button type="button" onClick={() => onFilter('YANDEX')}>Yandex</button>
        </div>
        <PickupMap points={points} selectedId={currentId} onSelect={setCurrentId} />
        <div className={styles.list}>
          {points.map((point) => (
            <button key={point.id} type="button" onClick={() => setCurrentId(point.id)} className={point.id === currentId ? styles.active : styles.row}>
              {point.title ?? point.provider} — {point.address}
            </button>
          ))}
        </div>
        <Button disabled={!selected} onClick={() => selected && void onConfirm(selected).then(onClose)}>Выбрать пункт</Button>
      </div>
    </Modal>
  );
};
