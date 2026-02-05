import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { api } from '../shared/api';
import { ReturnRequest } from '../shared/types';
import { Button } from '../shared/ui/Button';
import { ReturnCandidatesList } from '../components/returns/ReturnCandidatesList';
import { ReturnCandidate } from '../components/returns/ReturnCreateFlow';
import { ReturnList } from '../components/returns/ReturnList';
import styles from './ReturnsPage.module.css';

export const ReturnsPage = () => {
  const user = useAuthStore((state) => state.user);
  const orders = useOrdersStore((state) => state.orders);
  const loadBuyerOrders = useOrdersStore((state) => state.loadBuyerOrders);
  const navigate = useNavigate();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadBuyerOrders(user);
    }
  }, [loadBuyerOrders, user]);

  const loadReturns = async () => {
    setReturnsLoading(true);
    setReturnsError(null);
    try {
      const response = await api.returns.listMy();
      setReturns(response.data ?? []);
    } catch {
      setReturns([]);
      setReturnsError('Не удалось загрузить возвраты.');
    } finally {
      setReturnsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadReturns();
  }, [user]);

  const deliveredOrders = orders.filter((order) => order.status === 'DELIVERED');
  const returnCandidates = deliveredOrders.flatMap<ReturnCandidate>((order) =>
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

  const returnsByOrderItemId = useMemo(() => {
    const map = new Map<string, ReturnRequest>();
    returns.forEach((request) => {
      request.items?.forEach((item) => {
        if (item.orderItemId) {
          map.set(item.orderItemId, request);
        }
      });
    });
    return map;
  }, [returns]);

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
          <Button type="button" variant="secondary" onClick={() => navigate('/account?tab=chats')}>
            Перейти в чаты
          </Button>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Товары для возврата</h2>
          </div>
          {notice && (
            <div className={styles.notice}>
              <span>{notice}</span>
              <Button type="button" variant="secondary" onClick={() => navigate('/account?tab=chats')}>
                Перейти в чат
              </Button>
            </div>
          )}
          <ReturnCandidatesList
            items={returnCandidates}
            returnsByOrderItemId={returnsByOrderItemId}
            selectedOrderItemId={selectedOrderItemId}
            onSelect={(orderItemId) => {
              setNotice(null);
              setSelectedOrderItemId(orderItemId);
            }}
            onCreated={() => {
              setNotice('Заявка создана.');
              loadReturns();
            }}
            onAlreadyExists={async (orderItemId) => {
              await loadReturns();
              setNotice('Заявка уже создана.');
              setSelectedOrderItemId(null);
            }}
            onChat={() => navigate('/account?tab=chats')}
          />
        </div>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Мои заявки</h2>
            {returnsError && (
              <Button type="button" variant="secondary" onClick={() => loadReturns()}>
                Повторить загрузку
              </Button>
            )}
          </div>
          <ReturnList items={returns} isLoading={returnsLoading} error={returnsError} />
        </div>
      </div>
    </section>
  );
};
