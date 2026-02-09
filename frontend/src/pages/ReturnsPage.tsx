import { useEffect, useState } from 'react';
import { useAuthStore } from '../app/store/authStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { api } from '../shared/api';
import { ReturnRequest } from '../shared/types';
import { Button } from '../shared/ui/Button';
import { ReturnCandidatesList, ReturnCandidate } from '../components/returns/ReturnCandidatesList';
import { ReturnCreateFlow, ReturnCreateStep } from '../components/returns/ReturnCreateFlow';
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
  const [isCreateFlowOpen, setIsCreateFlowOpen] = useState(false);
  const [createStep, setCreateStep] = useState<ReturnCreateStep>('select');

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

  const openCreateFlow = (candidate?: ReturnCandidate | null) => {
    if (candidate) {
      setSelectedCandidate(candidate);
      setCreateStep('form');
    } else {
      setSelectedCandidate(null);
      setCreateStep('select');
    }
    setIsCreateFlowOpen(true);
  };

  const closeCreateFlow = () => {
    setIsCreateFlowOpen(false);
    setSelectedCandidate(null);
    setCreateStep('select');
  };

  const handleBack = () => {
    if (createStep === 'form') {
      setCreateStep('select');
      return;
    }
    closeCreateFlow();
  };

  const stepLabel = (() => {
    switch (createStep) {
      case 'select':
        return 'Шаг 1 из 3';
      case 'form':
        return 'Шаг 2 из 3';
      case 'success':
      case 'exists':
        return 'Шаг 3 из 3';
      default:
        return '';
    }
  })();

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
          {isCreateFlowOpen ? (
            <div className={styles.flowHeader}>
              <button type="button" className={styles.backButton} onClick={handleBack}>
                ← Назад
              </button>
              <span className={styles.flowTitle}>Оформление возврата · {stepLabel}</span>
            </div>
          ) : (
            <>
              <h1>Возвраты</h1>
              <Button type="button" onClick={() => openCreateFlow()}>
                Вернуть товар
              </Button>
            </>
          )}
        </div>
        {isCreateFlowOpen ? (
          <ReturnCreateFlow
            items={filteredCandidates}
            initialSelectedId={selectedCandidate?.orderItemId ?? null}
            step={createStep}
            onStepChange={setCreateStep}
            onCreated={async () => {
              await loadReturns();
            }}
            onReturnToList={closeCreateFlow}
          />
        ) : (
          <>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Товары для возврата</h2>
              </div>
              <ReturnCandidatesList
                items={filteredCandidates}
                returnsByOrderItemId={returnsByOrderItemId}
                onCreate={(item) => openCreateFlow(item)}
              />
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
          </>
        )}
      </div>
    </section>
  );
};
