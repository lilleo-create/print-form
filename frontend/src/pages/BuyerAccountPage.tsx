import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { api } from '../shared/api';
import { ChatMessage, ChatThread, Review, ReturnRequest } from '../shared/types';
import { Rating } from '../shared/ui/Rating';
import { Button } from '../shared/ui/Button';
import { PurchasedItemsList } from '../components/returns/PurchasedItemsList';
import { ReturnList } from '../components/returns/ReturnList';
import { ReturnCreateFlow } from '../components/returns/ReturnCreateFlow';
import { ChatThreadList } from '../components/chats/ChatThreadList';
import { ChatWindow } from '../components/chats/ChatWindow';
import styles from './BuyerAccountPage.module.css';

const formatReviewDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

export const BuyerAccountPage = () => {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const orders = useOrdersStore((state) => state.orders);
  const loadBuyerOrders = useOrdersStore((state) => state.loadBuyerOrders);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'profile';
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [showReturnCreate, setShowReturnCreate] = useState(false);
  const [chatThreads, setChatThreads] = useState<{ active: ChatThread[]; closed: ChatThread[] }>({
    active: [],
    closed: []
  });
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? ''
  });

  useEffect(() => {
    if (!user) return;
    setFormValues({
      name: user.name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? ''
    });
  }, [user]);

  useEffect(() => {
    api
      .getMyReviews()
      .then((response) => {
        setReviews(response.data?.data ?? []);
      })
      .catch(() => {
        setReviews([]);
      });
  }, []);

  useEffect(() => {
    if (user) {
      loadBuyerOrders(user);
    }
  }, [loadBuyerOrders, user]);

  useEffect(() => {
    if (activeTab !== 'returns') return;
    setReturnsLoading(true);
    setReturnsError(null);
    api.returns
      .listMy()
      .then((response) => {
        setReturns(response.data ?? []);
      })
      .catch(() => {
        setReturns([]);
        setReturnsError('Не удалось загрузить возвраты.');
      })
      .finally(() => setReturnsLoading(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'chats') return;
    api.chats
      .listMy()
      .then((response) => {
        setChatThreads(response.data ?? { active: [], closed: [] });
        if (!selectedThread && response.data?.active?.[0]) {
          setSelectedThread(response.data.active[0]);
        }
      })
      .catch(() => {
        setChatThreads({ active: [], closed: [] });
      });
  }, [activeTab, selectedThread]);

  const loadChatThread = async (threadId: string) => {
    setChatLoading(true);
    setChatError(null);
    try {
      const response = await api.chats.getThread(threadId);
      setSelectedThread(response.data.thread);
      setChatMessages(response.data.messages ?? []);
    } catch {
      setChatMessages([]);
      setChatError('Не удалось загрузить чат.');
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedThread || activeTab !== 'chats') return;
    loadChatThread(selectedThread.id);
    const interval = window.setInterval(() => {
      loadChatThread(selectedThread.id);
    }, 7000);
    return () => window.clearInterval(interval);
  }, [activeTab, selectedThread?.id]);

  const handleSendMessage = async (text: string) => {
    if (!selectedThread) return;
    try {
      await api.chats.sendMessage(selectedThread.id, { text });
      await loadChatThread(selectedThread.id);
      const refreshed = await api.chats.listMy();
      setChatThreads(refreshed.data ?? { active: [], closed: [] });
    } catch {
      setChatError('Не удалось отправить сообщение.');
    }
  };

  const avatarText = useMemo(() => {
    const source = user?.name ?? user?.email ?? 'Пользователь';
    return source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }, [user?.email, user?.name]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        name: formValues.name,
        email: formValues.email,
        phone: formValues.phone
      });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleVisibilityToggle = async (reviewId: string, hideFromOthers: boolean) => {
    const nextIsPublic = !hideFromOthers;
    const response = await api.updateReviewVisibility(reviewId, nextIsPublic);
    setReviews((prev) =>
      prev.map((review) => (review.id === reviewId ? { ...review, ...response.data.data } : review))
    );
  };

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const activeOrders = orders.filter((order) => order.status !== 'DELIVERED');
  const deliveredOrders = orders.filter((order) => order.status === 'DELIVERED');

  const purchasedItems = deliveredOrders.flatMap((order) =>
    (order.items ?? []).map((item) => ({
      productId: item.productId,
      title: item.title,
      price: item.price,
      image: item.image,
      orderDate: order.statusUpdatedAt ?? order.createdAt,
      orderId: order.id
    }))
  );

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

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1>Личный кабинет</h1>
          <p>Управляйте личными данными и отзывами.</p>
        </div>

        <nav className={styles.tabs}>
          <button
            type="button"
            className={activeTab === 'profile' ? styles.tabActive : styles.tab}
            onClick={() => setTab('profile')}
          >
            Профиль
          </button>
          <button
            type="button"
            className={activeTab === 'orders' ? styles.tabActive : styles.tab}
            onClick={() => setTab('orders')}
          >
            Заказы
          </button>
          <button
            type="button"
            className={activeTab === 'purchases' ? styles.tabActive : styles.tab}
            onClick={() => setTab('purchases')}
          >
            Купленные товары
          </button>
          <button
            type="button"
            className={activeTab === 'returns' ? styles.tabActive : styles.tab}
            onClick={() => setTab('returns')}
          >
            Возвраты
          </button>
          <button
            type="button"
            className={activeTab === 'chats' ? styles.tabActive : styles.tab}
            onClick={() => setTab('chats')}
          >
            Чаты
          </button>
        </nav>

        {activeTab === 'profile' && (
          <>
            <div className={styles.profileCard}>
              <div className={styles.avatar}>{avatarText}</div>
              <div className={styles.profileInfo}>
                <div className={styles.profileHeader}>
                  <h2>Персональные данные</h2>
                  <button
                    type="button"
                    className={styles.editButton}
                    onClick={() => setIsEditing((prev) => !prev)}
                  >
                    ✎
                  </button>
                </div>
                {isEditing ? (
                  <div className={styles.editGrid}>
                    <label>
                      Имя
                      <input
                        value={formValues.name}
                        onChange={(event) =>
                          setFormValues((prev) => ({ ...prev, name: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Email
                      <input
                        value={formValues.email}
                        onChange={(event) =>
                          setFormValues((prev) => ({ ...prev, email: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Телефон
                      <input
                        value={formValues.phone}
                        onChange={(event) =>
                          setFormValues((prev) => ({ ...prev, phone: event.target.value }))
                        }
                      />
                    </label>
                    <Button type="button" onClick={handleSave} disabled={saving}>
                      Сохранить
                    </Button>
                  </div>
                ) : (
                  <div className={styles.profileDetails}>
                    <div>
                      <span>Имя</span>
                      <strong>{user?.name ?? '—'}</strong>
                    </div>
                    <div>
                      <span>Email</span>
                      <strong>{user?.email ?? '—'}</strong>
                    </div>
                    <div>
                      <span>Телефон</span>
                      <strong>{user?.phone ?? '—'}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.reviewsSection}>
              <h2>Мои отзывы</h2>
              {reviews.length === 0 ? (
                <p className={styles.empty}>Вы еще не оставляли отзывы.</p>
              ) : (
                <div className={styles.reviewList}>
                  {reviews.map((review) => (
                    <article key={review.id} className={styles.reviewCard}>
                      <div className={styles.reviewHeader}>
                        {review.product?.image && (
                          <img
                            src={review.product.image}
                            alt={review.product.title}
                            className={styles.reviewImage}
                          />
                        )}
                        <div>
                          <h3>{review.product?.title ?? 'Отзыв'}</h3>
                          <span className={styles.reviewDate}>{formatReviewDate(review.createdAt)}</span>
                        </div>
                        <div className={styles.reviewRating}>
                          <Rating value={review.rating} count={0} size="sm" />
                        </div>
                      </div>
                      <div className={styles.reviewBody}>
                        <p>
                          <strong>Достоинства:</strong> {review.pros}
                        </p>
                        <p>
                          <strong>Недостатки:</strong> {review.cons}
                        </p>
                        <p>
                          <strong>Комментарий:</strong> {review.comment}
                        </p>
                      </div>
                      <label className={styles.visibilityToggle}>
                        <input
                          type="checkbox"
                          checked={review.isPublic === false}
                          onChange={(event) => handleVisibilityToggle(review.id, event.target.checked)}
                        />
                        Скрыть от других
                      </label>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'orders' && (
          <div className={styles.section}>
            {activeOrders.length === 0 ? (
              <p className={styles.empty}>Активных заказов нет.</p>
            ) : (
              <div className={styles.ordersList}>
                {activeOrders.map((order) => (
                  <article key={order.id} className={styles.orderCard}>
                    <div className={styles.orderHeader}>
                      <div>
                        <h3>Заказ №{order.id}</h3>
                        <span>
                          {new Date(order.createdAt).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className={styles.total}>{order.total.toLocaleString('ru-RU')} ₽</div>
                    </div>
                    <ul className={styles.items}>
                      {order.items.map((item) => (
                        <li key={`${order.id}-${item.productId}`} className={styles.item}>
                          <div className={styles.itemInfo}>
                            <strong>{item.title}</strong>
                            <span>{item.qty} шт.</span>
                          </div>
                          <span>{item.lineTotal.toLocaleString('ru-RU')} ₽</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'purchases' && (
          <div className={styles.section}>
            <PurchasedItemsList items={purchasedItems} />
          </div>
        )}

        {activeTab === 'returns' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Возвраты</h2>
              <Button type="button" onClick={() => setShowReturnCreate((prev) => !prev)}>
                Вернуть товар
              </Button>
            </div>
            {showReturnCreate && (
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
            )}
            {!showReturnCreate && (
              <ReturnList items={returns} isLoading={returnsLoading} error={returnsError} />
            )}
          </div>
        )}

        {activeTab === 'chats' && (
          <div className={styles.chatLayout}>
            <div className={styles.chatList}>
              <ChatThreadList
                title="Активные"
                threads={chatThreads.active ?? []}
                activeId={selectedThread?.id}
                onSelect={(thread) => setSelectedThread(thread)}
              />
              <ChatThreadList
                title="Завершенные"
                threads={chatThreads.closed ?? []}
                activeId={selectedThread?.id}
                onSelect={(thread) => setSelectedThread(thread)}
              />
            </div>
            <ChatWindow
              thread={selectedThread}
              messages={chatMessages}
              loading={chatLoading}
              error={chatError}
              onSend={handleSendMessage}
            />
          </div>
        )}
      </div>
    </section>
  );
};
