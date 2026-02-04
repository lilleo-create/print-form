import { useEffect, useState } from 'react';
import { useAuthStore } from '../app/store/authStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { api } from '../shared/api';
import { ReturnRequest } from '../shared/types';
import { Button } from '../shared/ui/Button';
import { ReturnCreateFlow } from '../components/returns/ReturnCreateFlow';
import { ReturnList } from '../components/returns/ReturnList';
import styles from './ReturnsPage.module.css';

export const ReturnsPage = () => {
  const user = useAuthStore((state) => state.user);
  const orders = useOrdersStore((state) => state.orders);
  const loadBuyerOrders = useOrdersStore((state) => state.loadBuyerOrders);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [showReturnCreate, setShowReturnCreate] = useState(false);

  useEffect(() => {
    if (user) {
      loadBuyerOrders(user);
    }
  }, [loadBuyerOrders, user]);

  useEffect(() => {
    if (!user) return;
    setReturnsLoading(true);
    setReturnsError(null);
    api.returns
      .listMy()
      .then((response) => setReturns(response.data ?? []))
      .catch(() => {
        setReturns([]);
        setReturnsError('Не удалось загрузить возвраты.');
      })
      .finally(() => setReturnsLoading(false));
  }, [user]);

  const deliveredOrders = orders.filter((order) => order.status === 'DELIVERED');
  const returnCandidates = deliveredOrders.flatMap((order) =>
    (order.items ?? [])
      .filter((item) => item.id)
      .map((item) => ({
        orderItemId: item.id as string,
        productId: item.productId,
        title: item.title,
        price: item.price,
        image: item.image,
        orderDate: order.statusUpdatedAt ?? order.createdAt,
        orderId: order.id
      }))
  );

  if (!user) {
    return (
      <section className={styles.page}>
        <div className="container">
          <p className={styles.empty}>Войдите в аккаунт, чтобы управлять возвратами.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1>Возвраты</h1>
          <Button type="button" onClick={() => setShowReturnCreate((prev) => !prev)}>
            Вернуть товар
          </Button>
        </div>
        {showReturnCreate ? (
          <ReturnCreateFlow
            items={returnCandidates}
            onCreated={() => {
              setShowReturnCreate(false);
              api.returns
                .listMy()
                .then((response) => setReturns(response.data ?? []))
                .catch(() => setReturns([]));
            }}
            onReturnToList={() => setShowReturnCreate(false)}
          />
        ) : (
          <ReturnList items={returns} isLoading={returnsLoading} error={returnsError} />
        )}
      </div>
    </section>
  );
};
