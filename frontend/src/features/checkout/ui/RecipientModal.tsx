import { useRef, useState } from 'react';
import { Modal } from '../../../shared/ui/Modal';
import { Button } from '../../../shared/ui/Button';
import { useModalFocus } from '../../../shared/lib/useModalFocus';
import type { CheckoutDto } from '../api/checkoutApi';
import styles from './RecipientModal.module.css';

type Props = { isOpen: boolean; onClose: () => void; initial: CheckoutDto['recipient']; onSave: (data: CheckoutDto['recipient']) => Promise<void> };

export const RecipientModal = ({ isOpen, onClose, initial, onSave }: Props) => {
  const [form, setForm] = useState(initial);
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, onClose, ref);

  return (
    <Modal isOpen={isOpen} onClose={onClose} role="dialog" aria-modal="true" className={styles.modal}>
      <div ref={ref} className={styles.content}>
        <h3>Получатель</h3>
        <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Имя" />
        <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Телефон" />
        <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" />
        <Button onClick={() => void onSave(form).then(onClose)}>Сохранить</Button>
      </div>
    </Modal>
  );
};
