import { useRef, useState } from 'react';
import { Modal } from '../../../shared/ui/Modal';
import { Button } from '../../../shared/ui/Button';
import { useModalFocus } from '../../../shared/lib/useModalFocus';
import styles from './AddCardModal.module.css';

type Props = { isOpen: boolean; onClose: () => void; onSubmit: (payload: { cardNumber: string; expMonth: string; expYear: string; cvv: string }) => Promise<void> };

export const AddCardModal = ({ isOpen, onClose, onSubmit }: Props) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvv, setCvv] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, onClose, ref);

  const handleSubmit = async () => {
    await onSubmit({ cardNumber, expMonth, expYear, cvv });
    setCvv('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} role="dialog" aria-modal="true" className={styles.modal}>
      <div ref={ref} className={styles.content}>
        <h3>Добавьте карту любого банка</h3>
        <input placeholder="Номер карты" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
        <div className={styles.row}>
          <input placeholder="MM" value={expMonth} onChange={(e) => setExpMonth(e.target.value)} />
          <input placeholder="YY" value={expYear} onChange={(e) => setExpYear(e.target.value)} />
          <input placeholder="CVV" value={cvv} onChange={(e) => setCvv(e.target.value)} />
        </div>
        <p>Добавляя карту, вы соглашаетесь с условиями сервиса.</p>
        <Button onClick={() => void handleSubmit()}>Добавить карту</Button>
      </div>
    </Modal>
  );
};
