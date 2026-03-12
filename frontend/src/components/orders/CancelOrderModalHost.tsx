import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ordersApi } from '../../shared/api/ordersApi';
import { useAuthStore } from '../../app/store/authStore';
import { useOrdersStore } from '../../app/store/ordersStore';
import { Modal } from '../../shared/ui/Modal';
import { Button } from '../../shared/ui/Button';
import styles from './OrdersComponents.module.css';

const reasons = ['Изменился адрес', 'Хочу изменить состав заказа', 'Слишком долгий срок', 'Передумал(а)'];

export const CancelOrderModalHost = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const loadBuyerOrders = useOrdersStore((state) => state.loadBuyerOrders);
  const [reason, setReason] = useState(reasons[0]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const orderId = useMemo(() => new URLSearchParams(location.search).get('orderId'), [location.search]);
  const isOpen = location.pathname === '/cancel' && Boolean(orderId);

  const close = () => navigate('/account?tab=orders');

  const submit = async () => {
    if (!orderId) return;
    setSubmitting(true);
    try {
      await ordersApi.cancelMyOrder(orderId);
      if (user) {
        await loadBuyerOrders(user);
      }
      close();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close}>
      <div className={styles.cancelModal}>
        <h3>Отмена заказа</h3>
        <select className={styles.select} value={reason} onChange={(e) => setReason(e.target.value)}>
          {reasons.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <textarea className={styles.textarea} placeholder="Комментарий (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <div className={styles.cardActions}>
          <Button type="button" onClick={submit} disabled={submitting}>Отменить заказ</Button>
          <Button type="button" variant="secondary" onClick={close}>Назад</Button>
        </div>
      </div>
    </Modal>
  );
};
