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

  useEffect(() => {
    if (activeTab !== 'returns') {
      setShowReturnCreate(false);
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

  return (
    <section className={styles.page}>
      <div className="container">
        {!isProfile && (
          <div className={styles.pageHeader}>
            <Link to="/account?tab=profile" className={styles.backLink}>
              Назад в аккаунт
            </Link>
            <div className={styles.pageHeading}>
              <h1>{pageTitle}</h1>
              {activeTab === 'returns' && (
                <Button type="button" onClick={() => setShowReturnCreate((prev) => !prev)}>
                  Вернуть товар
                </Button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && <ProfileTab user={user} />}

        {activeTab === 'orders' && <OrdersTab orders={activeOrders} />}

        {activeTab === 'purchases' && <PurchasesTab items={purchasedItems} />}

        {activeTab === 'returns' && (
          <ReturnsTab
            showReturnCreate={showReturnCreate}
            returnCandidates={returnCandidates}
            returns={returns}
            isLoading={returnsLoading}
            error={returnsError}
            onCreated={() => {
              setShowReturnCreate(false);
              reloadReturns();
            }}
            onReturnToList={() => setShowReturnCreate(false)}
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
