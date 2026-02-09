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
import styles from './BuyerAccountPage.module.css';

export const BuyerAccountPage = () => {
  const user = useAuthStore((state) => state.user);
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'profile';
  const threadIdParam = searchParams.get('threadId');
  const [showReturnCreate, setShowReturnCreate] = useState(false);
  const [returnCreateStep, setReturnCreateStep] = useState<'select' | 'form' | 'success' | 'exists'>('select');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'returns') {
      setShowReturnCreate(false);
      setReturnCreateStep('select');
      setSelectedCandidateId(null);
    }
  }, [activeTab]);

  const { activeOrders, purchasedItems, returnCandidates } = useBuyerOrders(user);

  const { returns, isLoading: returnsLoading, error: returnsError, reload: reloadReturns } =
    useMyReturns(activeTab);

  const {
    chatThreads,
    selectedThread,
    setSelectedThread,
    chatMessages,
    chatLoading,
    chatError,
    handleSendMessage
  } = useMyChats(activeTab, threadIdParam);

  const isProfile = activeTab === 'profile';
  const isReturns = activeTab === 'returns';
  const pageTitle = (() => {
    switch (activeTab) {
      case 'orders':
        return 'Заказы';
      case 'purchases':
        return 'Купленные товары';
      case 'returns':
        return 'Возвраты';
      case 'chats':
        return 'Чаты';
      default:
        return '';
    }
  })();

  const stepLabel = (() => {
    switch (returnCreateStep) {
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

  const openReturnCreate = () => {
    setSelectedCandidateId(null);
    setReturnCreateStep('select');
    setShowReturnCreate(true);
  };

  const openReturnFromItem = (itemId: string) => {
    setSelectedCandidateId(itemId);
    setReturnCreateStep('form');
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

  return (
    <section className={styles.page}>
      <div className="container">
        {!isProfile && (
          <div className={styles.pageHeader}>
            {isReturns && showReturnCreate ? (
              <div className={styles.flowHeader}>
                <button type="button" className={styles.backButton} onClick={handleReturnBack}>
                  ← Назад
                </button>
                <span className={styles.flowTitle}>Оформление возврата · {stepLabel}</span>
              </div>
            ) : (
              <>
                <Link to="/account?tab=profile" className={styles.backLink}>
                  Назад в аккаунт
                </Link>
                <div className={styles.pageHeading}>
                  <h1>{pageTitle}</h1>
                  {isReturns && (
                    <Button type="button" onClick={() => openReturnCreate()}>
                      Вернуть товар
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'profile' && <ProfileTab user={user} />}

        {activeTab === 'orders' && <OrdersTab orders={activeOrders} />}

        {activeTab === 'purchases' && <PurchasesTab items={purchasedItems} />}

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
            onOpenFromItem={(item) => {
              openReturnFromItem(item.orderItemId);
            }}
            onCreated={() => {
              closeReturnCreate();
              reloadReturns();
            }}
            onReturnToList={closeReturnCreate}
          />
        )}

        {activeTab === 'chats' && (
          <ChatsTab
            chatThreads={chatThreads}
            selectedThread={selectedThread}
            chatMessages={chatMessages}
            chatLoading={chatLoading}
            chatError={chatError}
            onSelectThread={setSelectedThread}
            onSendMessage={handleSendMessage}
          />
        )}
      </div>
    </section>
  );
};
