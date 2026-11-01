import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ordersApi } from '../../shared/api/ordersApi';
import { useAuthStore } from '../../app/store/authStore';
import { useOrdersStore } from '../../app/store/ordersStore';
import { Modal } from '../../shared/ui/Modal';
import { Button } from '../../shared/ui/Button';
import styles from './OrdersComponents.module.css';

export const CancelOrderModalHost = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const loadBuyerOrders = useOrdersStore((state) => state.loadBuyerOrders);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderId = useMemo(() => new URLSearchParams(location.search).get('orderId'), [location.search]);
  const isOpen = location.pathname === '/cancel' && Boolean(orderId);

  const close = () => navigate('/account?tab=orders');

  const submit = async () => {
    if (!orderId) return;
    setSubmitting(true);
    setError(null);
    try {
      await ordersApi.cancelMyOrder(orderId);
      if (user) {
        await loadBuyerOrders(user);
      }
      close();
    } catch {
      setError('Не удалось отменить заказ. Его статус мог измениться — обновите страницу и попробуйте снова.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close}>
      <div className={styles.cancelModal}>
        <h3>Отмена заказа</h3>
        <p>Если заказ уже оплачен, мы оформим возврат всей уплаченной суммы.</p>
        {error && <p role="alert">{error}</p>}
        <div className={styles.cardActions}>
          <Button type="button" onClick={submit} disabled={submitting}>Отменить заказ</Button>
          <Button type="button" variant="secondary" onClick={close}>Назад</Button>
        </div>
      </div>
    </Modal>
  );
};
