import { useEffect, useState } from 'react';
import { useAuthStore } from '../app/store/authStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { api } from '../shared/api';
import { ReturnRequest } from '../shared/types';
import { Button } from '../shared/ui/Button';
import { ReturnCandidatesList, ReturnCandidate } from '../components/returns/ReturnCandidatesList';
import { ReturnCreateFlow } from '../components/returns/ReturnCreateFlow';
import { ReturnList } from '../components/returns/ReturnList';
import styles from './ReturnsPage.module.css';

const filterReturnCandidates = (
  items: ReturnCandidate[],
  returnsByOrderItemId: Map<string, ReturnRequest>,
  approvedOrderItemIds: Set<string>
) =>
  items.filter((item) => {
    if (approvedOrderItemIds.has(item.orderItemId)) return false;
    const existing = returnsByOrderItemId.get(item.orderItemId);
    if (existing && existing.status !== 'REJECTED') return false;
    return true;
  });

export const ReturnsPage = () => {
  const user = useAuthStore((state) => state.user);
  const orders = useOrdersStore((state) => state.orders);
  const loadBuyerOrders = useOrdersStore((state) => state.loadBuyerOrders);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<ReturnCandidate | null>(null);

  const loadReturns = () => {
    if (!user) return Promise.resolve();
    setReturnsLoading(true);
    setReturnsError(null);
    return api.returns
      .listMy()
      .then((response) => setReturns(response.data ?? []))
      .catch(() => {
        setReturns([]);
        setReturnsError('Не удалось загрузить возвраты.');
      })
      .finally(() => setReturnsLoading(false));
  };

  useEffect(() => {
    if (user) {
      loadBuyerOrders(user);
    }
  }, [loadBuyerOrders, user]);

  useEffect(() => {
    if (!user) return;
    loadReturns();
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

  const returnsByOrderItemId = new Map<string, ReturnRequest>();
  returns.forEach((request) => {
    (request.items ?? []).forEach((item) => {
      if (item.orderItemId) {
        returnsByOrderItemId.set(item.orderItemId, request);
      }
    });
  });

  const approvedOrderItemIds = new Set(
    returns
      .filter((request) => request.status === 'APPROVED' || request.status === 'REFUNDED')
      .flatMap((request) => (request.items ?? []).map((item) => item.orderItemId))
  );

  const filteredCandidates = filterReturnCandidates(
    returnCandidates,
    returnsByOrderItemId,
    approvedOrderItemIds
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
        </div>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Товары для возврата</h2>
          </div>
          <ReturnCandidatesList
            items={filteredCandidates}
            returnsByOrderItemId={returnsByOrderItemId}
            onCreate={(item) => setSelectedCandidate(item)}
          />
          {selectedCandidate && (
            <ReturnCreateFlow
              items={filteredCandidates}
              initialSelectedId={selectedCandidate.orderItemId}
              onCreated={async () => {
                await loadReturns();
                setSelectedCandidate(null);
              }}
              onReturnToList={() => setSelectedCandidate(null)}
            />
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Мои заявки</h2>
            <Button type="button" variant="secondary" onClick={() => loadReturns()}>
              Обновить
            </Button>
          </div>
          <ReturnList items={returns} isLoading={returnsLoading} error={returnsError} />
        </div>
      </div>
    </section>
  );
};
