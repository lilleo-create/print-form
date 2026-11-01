import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../app/store/authStore';
import { Button } from '../../shared/ui/Button';
import { OrdersTab } from './tabs/OrdersTab/OrdersTab';
import { PurchasesTab } from './tabs/PurchasesTab/PurchasesTab';
import { ReturnsTab } from './tabs/ReturnsTab/ReturnsTab';
import { ChatsTab } from './tabs/ChatsTab/ChatsTab';
import { ProfileTab } from './tabs/ProfileTab/ProfileTab';
import { useBuyerOrders } from './hooks/useBuyerOrders';
import { useMyReturns } from './hooks/useMyReturns';
import { useMyChats } from './hooks/useMyChats';
import { AdSidebar } from '../../components/product/AdSidebar';
import { OrdersRecommendations } from './OrdersRecommendations';
import styles from './BuyerAccountPage.module.css';

export const BuyerAccountPage = () => {
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'profile';
  const threadIdParam = searchParams.get('threadId');
  const [showReturnCreate, setShowReturnCreate] = useState(false);
  const [returnCreateStep, setReturnCreateStep] = useState<
    'select' | 'form' | 'success' | 'exists'
  >('select');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (activeTab !== 'returns') {
      setShowReturnCreate(false);
      setReturnCreateStep('select');
      setSelectedCandidateId(null);
    }
  }, [activeTab]);

  const { activeOrders, completedOrders, purchasedItems, returnCandidates, reloadOrders } =
    useBuyerOrders(user);
  const orderFilter = searchParams.get('view') === 'completed' ? 'completed' : 'active';
  const isOrdersArea = activeTab === 'orders' || activeTab === 'purchases';
  const visibleOrders = orderFilter === 'completed' ? completedOrders : activeOrders;
  const byNewest = (a: { createdAt: string }, b: { createdAt: string }) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  const recentOrders = [
    ...activeOrders.filter(order => order.paymentStatus === 'PAID').sort(byNewest),
    ...completedOrders.filter(order => order.status === 'DELIVERED').sort(byNewest)
  ].slice(0, 2);

  const {
    returns,
    isLoading: returnsLoading,
    error: returnsError,
    reload: reloadReturns
  } = useMyReturns(activeTab);

  const {
    chatThreads,
    selectedThread,
    setSelectedThread,
    chatMessages,
    chatLoading,
    chatError,
    handleSendMessage,
    creatingSupportThread,
    sendNewSupportQuestion,
    sendQuickSupportQuestion
  } = useMyChats(activeTab, threadIdParam);

  const isProfile = activeTab === 'profile';
  const isReturns = activeTab === 'returns';
  const isChats = activeTab === 'chats';

  const pageTitle = (() => {
    switch (activeTab) {
      case 'orders':    return 'Заказы';
      case 'purchases': return 'Купленные товары';
      case 'returns':   return 'Возвраты';
      default:          return '';
    }
  })();

  const stepLabel = (() => {
    switch (returnCreateStep) {
      case 'select':               return 'Шаг 1 из 3';
      case 'form':                 return 'Шаг 2 из 3';
      case 'success': case 'exists': return 'Шаг 3 из 3';
      default:                     return '';
    }
  })();

  const openReturnCreate = () => {
    setSelectedCandidateId(null);
    setReturnCreateStep('select');
    setShowReturnCreate(true);
  };

  const closeReturnCreate = () => {
    setShowReturnCreate(false);
    setReturnCreateStep('select');
    setSelectedCandidateId(null);
  };

  const handleReturnBack = () => {
    if (returnCreateStep === 'form') {
      setReturnCreateStep('select');
      return;
    }
    closeReturnCreate();
  };

  if (isChats) {
    return (
      <section className={styles.pageChats}>
        <ChatsTab
          recentOrders={recentOrders}
          chatThreads={chatThreads}
          selectedThread={selectedThread}
          chatMessages={chatMessages}
          chatLoading={chatLoading}
          chatError={chatError}
          creatingSupportThread={creatingSupportThread}
          onSelectThread={setSelectedThread}
          onShowSupportStart={() => {
            setSelectedThread(null);
            if (threadIdParam) {
              setSearchParams(previous => {
                const next = new URLSearchParams(previous);
                next.delete('threadId');
                return next;
              }, { replace: true });
            }
          }}
          onSendMessage={handleSendMessage}
          onSubmitSupportQuestion={sendNewSupportQuestion}
          onSubmitQuickQuestion={sendQuickSupportQuestion}
        />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className="container">
        {!isProfile && !isOrdersArea && (
          <div className={styles.pageHeader}>
            {isReturns && showReturnCreate ? (
              <div className={styles.flowHeader}>
                <button
                  type="button"
                  className={styles.backButton}
                  onClick={handleReturnBack}
                >
                  ← Назад
                </button>
                <span className={styles.flowTitle}>
                  Оформление возврата · {stepLabel}
                </span>
              </div>
            ) : (
              <div className={styles.pageHeading}>
                <h1>{pageTitle}</h1>
                {isReturns && (
                  <Button type="button" onClick={() => openReturnCreate()}>
                    Вернуть товар
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && <ProfileTab user={user} />}

        {isOrdersArea && <div className={styles.ordersLayout}>
          <div className={styles.ordersContent}>
            <nav className={styles.mainTabs} aria-label="Раздел заказов">
              <Link to="/account?tab=orders" className={activeTab === 'orders' ? styles.mainTabActive : styles.mainTab} aria-current={activeTab === 'orders' ? 'page' : undefined}>Заказы</Link>
              <Link to="/account?tab=purchases" className={activeTab === 'purchases' ? styles.mainTabActive : styles.mainTab} aria-current={activeTab === 'purchases' ? 'page' : undefined}>Товары</Link>
            </nav>
            {activeTab === 'orders' ? <>
              <div className={styles.orderFilters} role="group" aria-label="Состояние заказов">
                <button type="button" className={orderFilter === 'active' ? styles.filterActive : styles.filter} aria-pressed={orderFilter === 'active'} onClick={() => { const next = new URLSearchParams(searchParams); next.delete('view'); setSearchParams(next); }}>Активные</button>
                <button type="button" className={orderFilter === 'completed' ? styles.filterActive : styles.filter} aria-pressed={orderFilter === 'completed'} onClick={() => { const next = new URLSearchParams(searchParams); next.set('view', 'completed'); setSearchParams(next); }}>Завершённые</button>
              </div>
              {visibleOrders.length ? <OrdersTab orders={visibleOrders} /> : <>
                <div className={styles.orderEmpty}><span className={styles.emptyIcon} aria-hidden="true">▧</span><h2>{orderFilter === 'active' ? 'Нет активных заказов' : 'Нет завершённых заказов'}</h2><p>{orderFilter === 'active' ? 'Здесь будут заказы, которые готовятся, едут или ждут получения.' : 'Здесь появятся полученные, отменённые и возвращённые заказы.'}</p></div>
                <OrdersRecommendations />
              </>}
            </> : <PurchasesTab items={purchasedItems} />}
          </div>
          <div className={styles.ordersSidebar}><AdSidebar /></div>
        </div>}

        {activeTab === 'returns' && (
          <ReturnsTab
            showReturnCreate={showReturnCreate}
            createStep={returnCreateStep}
            selectedCandidateId={selectedCandidateId}
            returnCandidates={returnCandidates}
            returns={returns}
            isLoading={returnsLoading}
            error={returnsError}
            onStepChange={setReturnCreateStep}
            onCreated={() => {
              closeReturnCreate();
              reloadReturns();
              void reloadOrders();
            }}
            onReturnToList={closeReturnCreate}
          />
        )}
      </div>
    </section>
  );
};
