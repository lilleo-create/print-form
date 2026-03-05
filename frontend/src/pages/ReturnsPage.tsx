import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { api } from '../shared/api';
import { ReturnRequest } from '../shared/types';
import { getDeliveryStage, hasHandoverStarted } from '../shared/lib/deliveryStatus';
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
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const orders = useOrdersStore((state) => state.orders);
  const loadBuyerOrders = useOrdersStore((state) => state.loadBuyerOrders);

  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState<string | null>(null);

  const [selectedCandidate, setSelectedCandidate] = useState<ReturnCandidate | null>(null);
  const [isCreateFlowOpen, setIsCreateFlowOpen] = useState(false);
  const [createStep, setCreateStep] = useState<ReturnCreateStep>('select');
  const highlightedOrderId = searchParams.get('orderId');

  const loadReturns = useCallback(() => {
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
  }, [user]);

  useEffect(() => {
    if (user) loadBuyerOrders(user);
  }, [loadBuyerOrders, user]);

  useEffect(() => {
    if (!user) return;
    loadReturns();
  }, [loadReturns, user]);

  const deliveredOrders = orders.filter((order) =>
    order.status === 'PAID' ||
    order.status === 'READY_FOR_SHIPMENT' ||
    hasHandoverStarted(order)
  );
  const cancellationOrders = orders.filter((order) => {
    const stage = getDeliveryStage(order);
    return (order.status === 'PAID' || order.status === 'READY_FOR_SHIPMENT') && (stage === 'CREATING' || stage === 'PRINTING' || stage === 'READY_FOR_DROP');
  });

  const toCandidates = (sourceOrders: typeof orders) => sourceOrders.flatMap((order) =>
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

  const returnCandidates = toCandidates(deliveredOrders);
  const cancellationCandidates = toCandidates(cancellationOrders);

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

  const filteredCandidates = filterReturnCandidates(returnCandidates, returnsByOrderItemId, approvedOrderItemIds);
  const filteredCancellationCandidates = filterReturnCandidates(cancellationCandidates, returnsByOrderItemId, approvedOrderItemIds);

  useEffect(() => {
    if (!highlightedOrderId || isCreateFlowOpen) return;
    const candidate = filteredCandidates.find((item) => item.orderId === highlightedOrderId);
    if (!candidate) return;
    openCreateFlow(candidate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedOrderId, filteredCandidates, isCreateFlowOpen]);

  const openCreateFlow = (candidate?: ReturnCandidate | null) => {
    setIsCreateFlowOpen(true);

    if (candidate) {
      setSelectedCandidate(candidate);
      setCreateStep('form'); // если нажали "вернуть" на конкретном товаре
      return;
    }

    setSelectedCandidate(null);
    setCreateStep('select'); // если открыли по кнопке "Вернуть товар"
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
                highlightedOrderId={highlightedOrderId}
              />
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Отмена до отправки</h2>
              </div>
              <ReturnCandidatesList
                items={filteredCancellationCandidates}
                returnsByOrderItemId={returnsByOrderItemId}
                onCreate={(item) => openCreateFlow(item)}
                highlightedOrderId={highlightedOrderId}
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
