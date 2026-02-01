import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { api } from '../shared/api';
import { ordersApi } from '../shared/api/ordersApi';
import { useSellerGuard } from '../shared/hooks/useSellerGuard';
import { Order, OrderStatus, Payment, Product, SellerKycSubmission } from '../shared/types';
import { Button } from '../shared/ui/Button';
import { SellerProductModal, SellerProductPayload } from '../widgets/seller/SellerProductModal';
import styles from './SellerAccountPage.module.css';

const menuItems = [
  'Подключение',
  'Сводка',
  'Товары',
  'Заказы',
  'Логистика',
  'Продвижение',
  'Бухгалтерия',
  'Отчеты',
  'Поддержка',
  'Настройки'
] as const;

const statusFlow: OrderStatus[] = ['CREATED', 'PRINTING', 'HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED'];
const statusLabels: Record<OrderStatus, string> = {
  CREATED: 'Создается',
  PRINTING: 'Модель печатается',
  HANDED_TO_DELIVERY: 'Передано в доставку',
  IN_TRANSIT: 'В пути',
  DELIVERED: 'Доставлено'
};

const formatCurrency = (value: number) => value.toLocaleString('ru-RU');
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const isAccessError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('forbidden') || message.includes('unauthorized') || message.includes('401') || message.includes('403');
};

export const SellerAccountPage = () => {
  const [activeItem, setActiveItem] = useState<(typeof menuItems)[number]>('Сводка');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersView, setOrdersView] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [orderUpdateId, setOrderUpdateId] = useState<string | null>(null);
  const [orderUpdateError, setOrderUpdateError] = useState<string | null>(null);
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, { trackingNumber: string; carrier: string }>>({});
  const [kycSubmission, setKycSubmission] = useState<SellerKycSubmission | null>(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [isKycUploading, setIsKycUploading] = useState(false);
  const [kycMessage, setKycMessage] = useState<string | null>(null);
  const [kycError, setKycError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const canSell = kycSubmission?.status === 'APPROVED';
  const userId = useAuthStore((state) => state.user?.id);
  const { authStatus, sellerStatus, sellerProfile, error: sellerGuardError, reload } = useSellerGuard();
  const isSellerReady = authStatus === 'authorized' && sellerStatus === 'seller';
  const isAuthLoading = authStatus === 'loading';

  const loadProducts = async () => {
    setIsProductsLoading(true);
    setProductsError(null);
    try {
      const productsResponse = await api.getSellerProducts();
      setProducts(productsResponse.data);
    } catch (error) {
      setProducts([]);
      if (isAccessError(error) && isSellerReady) {
        setProductsError('Сессия истекла, войдите снова.');
      }
    } finally {
      setIsProductsLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      if (!userId) {
        setOrders([]);
        setOrdersView([]);
        return;
      }
      if (!isSellerReady) {
        setOrders([]);
        setOrdersView([]);
        return;
      }
      const data = await ordersApi.listBySeller(userId);
      setOrders(data);
      setOrdersView(statusFilter === 'ALL' ? data : data.filter((order) => order.status === statusFilter));
      setTrackingDrafts((prev) => {
        const next = { ...prev };
        data.forEach((order) => {
          next[order.id] = {
            trackingNumber: order.trackingNumber ?? next[order.id]?.trackingNumber ?? '',
            carrier: order.carrier ?? next[order.id]?.carrier ?? ''
          };
        });
        return next;
      });
    } catch (error) {
      setOrders([]);
      setOrdersView([]);
      if (isAccessError(error) && isSellerReady) {
        setOrdersError('Сессия истекла, войдите снова.');
      } else if (isSellerReady) {
        setOrdersError('Не удалось загрузить заказы.');
      }
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadOrdersByStatus = async (status: OrderStatus | 'ALL') => {
    if (status === 'ALL') {
      setOrdersView(orders);
      return;
    }
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      if (!userId || !isSellerReady) {
        setOrdersView([]);
        return;
      }
      const data = await ordersApi.listBySeller(userId, status);
      setOrdersView(data);
      setTrackingDrafts((prev) => {
        const next = { ...prev };
        data.forEach((order) => {
          next[order.id] = {
            trackingNumber: order.trackingNumber ?? next[order.id]?.trackingNumber ?? '',
            carrier: order.carrier ?? next[order.id]?.carrier ?? ''
          };
        });
        return next;
      });
    } catch (error) {
      setOrdersView([]);
      if (isAccessError(error) && isSellerReady) {
        setOrdersError('Сессия истекла, войдите снова.');
      } else if (isSellerReady) {
        setOrdersError('Не удалось загрузить заказы.');
      }
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadKyc = async () => {
    setKycLoading(true);
    setKycError(null);
    try {
      const response = await api.getSellerKyc();
      setKycSubmission(response.data);
    } catch (error) {
      setKycSubmission(null);
      if (isAccessError(error) && isSellerReady) {
        setKycError('Сессия истекла, войдите снова.');
      }
    } finally {
      setKycLoading(false);
    }
  };

  const loadPayments = async () => {
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const response = await api.getSellerPayments();
      setPayments(response.data ?? []);
    } catch (error) {
      setPayments([]);
      if (isAccessError(error) && isSellerReady) {
        setPaymentsError('Сессия истекла, войдите снова.');
      }
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    if (!isSellerReady) {
      setProducts([]);
      setPayments([]);
      setOrders([]);
      setOrdersView([]);
      setOrdersError(null);
      setPaymentsError(null);
      setProductsError(null);
      setKycSubmission(null);
      setKycLoading(false);
      setKycError(null);
      setIsProductsLoading(false);
      setPaymentsLoading(false);
      setOrdersLoading(false);
      return;
    }

    void loadProducts();
    void loadKyc();
    void loadPayments();
    if (userId) {
      void loadOrders();
    }
  }, [isSellerReady, userId]);

  useEffect(() => {
    if (!isSellerReady) {
      setOrdersView([]);
      return;
    }
    if (statusFilter === 'ALL') {
      setOrdersView(orders);
      return;
    }
    loadOrdersByStatus(statusFilter);
  }, [orders, statusFilter, isSellerReady]);

  const handleKycUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    if (!isSellerReady) {
      setKycMessage('Подключите профиль продавца, чтобы загрузить документы.');
      event.target.value = '';
      return;
    }
    setIsKycUploading(true);
    setKycMessage(null);
    setKycError(null);
    try {
      await api.uploadSellerKycDocuments(files);
      const response = await api.getSellerKyc();
      setKycSubmission(response.data);
      setKycMessage('Документы загружены.');
    } catch (error) {
      if (isAccessError(error)) {
        setKycError('Сессия истекла, войдите снова.');
      } else {
        setKycError('Не удалось загрузить документы.');
      }
    } finally {
      setIsKycUploading(false);
      event.target.value = '';
    }
  };

  const handleKycSubmit = async () => {
    if (!isSellerReady) {
      setKycMessage('Подключите профиль продавца, чтобы отправить документы.');
      return;
    }
    setKycMessage(null);
    setKycError(null);
    try {
      const response = await api.submitSellerKyc();
      setKycSubmission(response.data);
      setKycMessage('Заявка отправлена на проверку.');
      await reload();
    } catch (error) {
      if (isAccessError(error)) {
        setKycError('Сессия истекла, войдите снова.');
      } else {
        setKycError('Не удалось отправить документы.');
      }
    }
  };

  const handleSaveProduct = async (payload: SellerProductPayload) => {
    setKycMessage(null);
    setProductsError(null);
    try {
      if (payload.id) {
        await api.updateSellerProduct(payload.id, payload);
      } else {
        await api.createSellerProduct(payload);
      }
      setIsModalOpen(false);
      setActiveProduct(null);
      await loadProducts();
    } catch (error) {
      if (isAccessError(error) && isSellerReady) {
        setProductsError('Сессия истекла, войдите снова.');
      } else {
        setKycMessage('Загрузка товаров доступна после одобрения KYC.');
      }
    }
  };

  const handleStatusChange = async (order: Order, status: OrderStatus) => {
    setOrderUpdateError(null);
    const draft = trackingDrafts[order.id] ?? { trackingNumber: '', carrier: '' };
    const trackingNumber = draft.trackingNumber || order.trackingNumber || '';
    const carrier = draft.carrier || order.carrier || '';
    if (['HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED'].includes(status)) {
      if (!trackingNumber || !carrier) {
        setOrderUpdateError('Для доставки укажите номер отправления и службу доставки.');
        return;
      }
    }
    setOrderUpdateId(order.id);
    try {
      const response = await api.updateSellerOrderStatus(order.id, {
        status,
        trackingNumber: trackingNumber || undefined,
        carrier: carrier || undefined
      });
      const updated = response.data;
      setOrders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setOrdersView((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setTrackingDrafts((prev) => ({
        ...prev,
        [updated.id]: {
          trackingNumber: updated.trackingNumber ?? prev[updated.id]?.trackingNumber ?? '',
          carrier: updated.carrier ?? prev[updated.id]?.carrier ?? ''
        }
      }));
    } catch {
      setOrderUpdateError('Не удалось обновить статус заказа.');
    } finally {
      setOrderUpdateId(null);
    }
  };

  const summary = useMemo(() => {
    const totalProducts = products.length;
    const totalOrders = orders.length;
    const revenue = orders.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.lineTotal, 0),
      0
    );
    const statusCounts = statusFlow.reduce<Record<OrderStatus, number>>((acc, status) => {
      acc[status] = orders.filter((order) => order.status === status).length;
      return acc;
    }, {} as Record<OrderStatus, number>);

    return { totalProducts, totalOrders, revenue, statusCounts };
  }, [orders, products.length]);

  const reportRows = useMemo(() => {
    const days = 14;
    const now = new Date();
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (days - 1 - index));
      const dateKey = date.toISOString().split('T')[0];
      const ordersForDay = orders.filter((order) => order.createdAt.startsWith(dateKey));
      const revenue = ordersForDay.reduce(
        (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.lineTotal, 0),
        0
      );
      return {
        date: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        orders: ordersForDay.length,
        revenue
      };
    });
  }, [orders]);

  const hasSummaryData = summary.totalOrders > 0 || summary.totalProducts > 0;

  const logisticsOrders = orders.filter(
    (order) => order.trackingNumber || order.carrier || order.shippingAddress
  );

  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <aside className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <h2>Кабинет продавца</h2>
            <button type="button" className={styles.closeMenu} onClick={() => setIsMenuOpen(false)}>
              ✕
            </button>
          </div>
          <nav className={styles.menu}>
            {menuItems.map((item) => (
              <button
                key={item}
                type="button"
                className={item === activeItem ? styles.menuItemActive : styles.menuItem}
                onClick={() => {
                  setActiveItem(item);
                  setIsMenuOpen(false);
                }}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <div className={styles.content}>
          <div className={styles.topBar}>
            <button type="button" className={styles.menuToggle} onClick={() => setIsMenuOpen(true)}>
              ☰
            </button>
            <div>
              <h1>{activeItem}</h1>
              <p>Раздел продавца PrintForm.</p>
            </div>
          </div>

          {isAuthLoading && (
            <div className={styles.section}>
              <p className={styles.muted}>Загрузка...</p>
            </div>
          )}

          {authStatus === 'unauthorized' && (
            <div className={styles.section}>
              <div className={styles.infoCard}>
                <h2>Войдите в аккаунт</h2>
                <p className={styles.muted}>Авторизуйтесь, чтобы получить доступ к кабинету продавца.</p>
                <Link className={styles.linkButton} to="/auth/login?redirectTo=/seller">
                  Войти
                </Link>
              </div>
            </div>
          )}

          {authStatus === 'authorized' && sellerStatus === 'not_seller' && (
            <div className={styles.section}>
              <div className={styles.infoCard}>
                <h2>Подключение продавца</h2>
                <p className={styles.muted}>
                  Чтобы получить доступ к товарам, заказам и выплатам, заполните профиль продавца.
                </p>
                <Link className={styles.linkButton} to="/seller/onboarding">
                  Заполнить профиль
                </Link>
              </div>
            </div>
          )}

          {authStatus === 'authorized' && sellerStatus === 'unknown' && sellerGuardError && (
            <div className={styles.section}>
              <p className={styles.error}>Не удалось проверить профиль продавца: {sellerGuardError}</p>
            </div>
          )}

          {isSellerReady && (
            <>
              {activeItem === 'Сводка' && (
            <div className={styles.section}>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <h3>Заказы</h3>
                  <p>{summary.totalOrders} всего</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Выручка</h3>
                  <p>{formatCurrency(summary.revenue)} ₽</p>
                </div>
                <div className={styles.statCard}>
                  <h3>Товары</h3>
                  <p>{summary.totalProducts} в каталоге</p>
                </div>
              </div>
              {!hasSummaryData && <p className={styles.muted}>Данных пока нет.</p>}
              <div className={styles.statusList}>
                {statusFlow.map((status) => (
                  <div key={status} className={styles.statusRow}>
                    <span>{statusLabels[status]}</span>
                    <strong>{summary.statusCounts[status]}</strong>
                  </div>
                ))}
              </div>
            </div>
              )}

              {activeItem === 'Подключение' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>KYC документы</h2>
                  <p>Загрузите документы для верификации продавца.</p>
                </div>
              </div>
              {kycLoading ? (
                <p className={styles.muted}>Загрузка статуса...</p>
              ) : (
                <div className={styles.kycPanel}>
                  <div className={styles.kycRow}>
                    <span className={styles.kycLabel}>Статус:</span>
                    <strong>{kycSubmission?.status ?? 'Не отправлено'}</strong>
                  </div>
                  {kycSubmission?.notes && (
                    <p className={styles.kycNotes}>Комментарий: {kycSubmission.notes}</p>
                  )}
                  {kycSubmission?.documents?.length ? (
                    <ul className={styles.kycDocs}>
                      {kycSubmission.documents.map((doc) => (
                        <li key={doc.id}>
                          <a href={doc.url} target="_blank" rel="noreferrer">
                            {doc.originalName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.muted}>Документы не загружены.</p>
                  )}
                  <div className={styles.kycActions}>
                    <label className={styles.uploadButton}>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,image/png,image/jpeg"
                        onChange={handleKycUpload}
                        disabled={isKycUploading}
                      />
                      {isKycUploading ? 'Загрузка...' : 'Загрузить документы'}
                    </label>
                    <Button type="button" onClick={handleKycSubmit} disabled={!kycSubmission?.documents?.length}>
                      Отправить на проверку
                    </Button>
                  </div>
                  {kycError && <p className={styles.error}>{kycError}</p>}
                  {kycMessage && <p className={styles.kycMessage}>{kycMessage}</p>}
                </div>
              )}
            </div>
              )}

              {activeItem === 'Товары' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Товары продавца</h2>
                  <p>Создавайте и редактируйте карточки с описанием и фото.</p>
                </div>
                <div className={styles.sectionActions}>
                  <Button
                    type="button"
                    onClick={() => {
                      if (!canSell) {
                        return;
                      }
                      setActiveProduct(null);
                      setIsModalOpen(true);
                    }}
                    disabled={!canSell}
                  >
                    Добавить товар
                  </Button>
                  {!canSell && (
                    <span className={styles.helperText}>
                      Добавление товаров доступно после одобрения KYC.
                    </span>
                  )}
                </div>
              </div>
              {isProductsLoading ? (
                <p className={styles.muted}>Загрузка данных...</p>
              ) : productsError ? (
                <p className={styles.error}>{productsError}</p>
              ) : (
                <div className={styles.table}>
                  <div className={styles.tableHeader}>
                    <span>Название</span>
                    <span>Цена</span>
                    <span>Категория</span>
                    <span>Статус</span>
                    <span>Действия</span>
                  </div>
                  {products.length === 0 ? (
                    <p className={styles.muted}>Товаров пока нет.</p>
                  ) : (
                    products.map((product) => (
                      <div key={product.id} className={styles.tableRow}>
                        <span>{product.title}</span>
                        <span>{formatCurrency(product.price)} ₽</span>
                        <span>{product.category}</span>
                        <span>
                          <strong>{product.moderationStatus ?? '—'}</strong>
                          {product.moderationStatus === 'NEEDS_EDIT' && product.moderationNotes && (
                            <span className={styles.moderationNote}>{product.moderationNotes}</span>
                          )}
                        </span>
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() => {
                            setActiveProduct(product);
                            setIsModalOpen(true);
                          }}
                        >
                          Редактировать
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
              )}

              {activeItem === 'Заказы' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Заказы</h2>
                  <p>Управляйте статусами и отслеживайте выполнение.</p>
                </div>
                <div className={styles.filterRow}>
                  <label>
                    Статус:
                    <select
                      className={styles.select}
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as OrderStatus | 'ALL')}
                    >
                      <option value="ALL">Все</option>
                      {statusFlow.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {ordersLoading ? (
                <p className={styles.muted}>Загрузка заказов...</p>
              ) : ordersError ? (
                <p className={styles.error}>{ordersError}</p>
              ) : ordersView.length === 0 ? (
                <p className={styles.muted}>Заказов пока нет.</p>
              ) : (
                <div className={styles.ordersTable}>
                  <div className={styles.ordersHeader}>
                    <span>Заказ</span>
                    <span>Покупатель</span>
                    <span>Сумма</span>
                    <span>Статус</span>
                    <span>Доставка</span>
                  </div>
                  {ordersView.map((order) => {
                    const currentIndex = statusFlow.indexOf(order.status);
                    const nextStatus = statusFlow[currentIndex + 1];
                    const draft = trackingDrafts[order.id] ?? { trackingNumber: '', carrier: '' };
                    const total = order.items.reduce((sum, item) => sum + item.lineTotal, 0);
                    return (
                      <div key={order.id} className={styles.ordersRow}>
                        <div>
                          <strong>№{order.id}</strong>
                          <p className={styles.muted}>{formatDate(order.createdAt)}</p>
                        </div>
                        <div>
                          <p>{order.contact?.name ?? order.buyer?.name ?? '—'}</p>
                          <p className={styles.muted}>{order.contact?.phone ?? order.buyer?.email ?? ''}</p>
                        </div>
                        <div>{formatCurrency(total)} ₽</div>
                        <div>
                          <select
                            className={styles.select}
                            value={order.status}
                            disabled={!nextStatus || orderUpdateId === order.id}
                            onChange={(event) => handleStatusChange(order, event.target.value as OrderStatus)}
                          >
                            <option value={order.status}>{statusLabels[order.status]}</option>
                            {nextStatus && <option value={nextStatus}>{statusLabels[nextStatus]}</option>}
                          </select>
                          {orderUpdateId === order.id && <p className={styles.muted}>Обновляем...</p>}
                        </div>
                        <div className={styles.deliveryInputs}>
                          <input
                            className={styles.input}
                            placeholder="Трек-номер"
                            value={draft.trackingNumber}
                            onChange={(event) =>
                              setTrackingDrafts((prev) => ({
                                ...prev,
                                [order.id]: {
                                  trackingNumber: event.target.value,
                                  carrier: prev[order.id]?.carrier ?? ''
                                }
                              }))
                            }
                          />
                          <input
                            className={styles.input}
                            placeholder="Служба доставки"
                            value={draft.carrier}
                            onChange={(event) =>
                              setTrackingDrafts((prev) => ({
                                ...prev,
                                [order.id]: {
                                  trackingNumber: prev[order.id]?.trackingNumber ?? '',
                                  carrier: event.target.value
                                }
                              }))
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {orderUpdateError && <p className={styles.error}>{orderUpdateError}</p>}
            </div>
              )}

              {activeItem === 'Логистика' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Логистика</h2>
                  <p>Данные по доставке ваших заказов.</p>
                </div>
              </div>
              {logisticsOrders.length === 0 ? (
                <p className={styles.muted}>Нет данных по доставкам.</p>
              ) : (
                <div className={styles.ordersTable}>
                  <div className={styles.ordersHeader}>
                    <span>Заказ</span>
                    <span>Адрес</span>
                    <span>Статус</span>
                    <span>Доставка</span>
                  </div>
                  {logisticsOrders.map((order) => (
                    <div key={order.id} className={styles.ordersRow}>
                      <div>
                        <strong>№{order.id}</strong>
                        <p className={styles.muted}>{formatDate(order.createdAt)}</p>
                      </div>
                      <div>{order.shippingAddress?.addressText ?? '—'}</div>
                      <div>{statusLabels[order.status]}</div>
                      <div>
                        <p>{order.trackingNumber ?? '—'}</p>
                        <p className={styles.muted}>{order.carrier ?? '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
              )}

              {activeItem === 'Продвижение' && (
            <div className={styles.section}>
              <h2>Продвижение</h2>
              <p className={styles.muted}>Пока нет кампаний.</p>
            </div>
              )}

              {activeItem === 'Бухгалтерия' && (
            <div className={styles.section}>
              <h2>Бухгалтерия</h2>
              {paymentsLoading ? (
                <p className={styles.muted}>Загрузка платежей...</p>
              ) : paymentsError ? (
                <p className={styles.error}>{paymentsError}</p>
              ) : payments.length === 0 ? (
                <p className={styles.muted}>Данные о выплатах пока отсутствуют.</p>
              ) : (
                <div className={styles.ordersTable}>
                  <div className={styles.ordersHeader}>
                    <span>Дата</span>
                    <span>Заказ</span>
                    <span>Сумма</span>
                    <span>Статус</span>
                  </div>
                  {payments.map((payment) => (
                    <div key={payment.id} className={styles.ordersRow}>
                      <span>{formatDate(payment.createdAt)}</span>
                      <span>№{payment.orderId}</span>
                      <span>{formatCurrency(payment.amount)} {payment.currency}</span>
                      <span>{payment.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
              )}

              {activeItem === 'Отчеты' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Отчеты</h2>
                  <p>Заказы за последние 14 дней.</p>
                </div>
              </div>
              {orders.length === 0 ? (
                <p className={styles.muted}>Данных пока нет.</p>
              ) : (
                <div className={styles.reportTable}>
                  <div className={styles.reportHeader}>
                    <span>Дата</span>
                    <span>Заказы</span>
                    <span>Выручка</span>
                  </div>
                  {reportRows.map((row) => (
                    <div key={row.date} className={styles.reportRow}>
                      <span>{row.date}</span>
                      <span>{row.orders}</span>
                      <span>{formatCurrency(row.revenue)} ₽</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
              )}

              {activeItem === 'Поддержка' && (
            <div className={styles.section}>
              <h2>Поддержка</h2>
              <p className={styles.muted}>Пока нет обращений.</p>
            </div>
              )}

              {activeItem === 'Настройки' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Настройки профиля</h2>
                  <p>Актуальные данные магазина.</p>
                </div>
              </div>
              {sellerProfile ? (
                <div className={styles.settingsGrid}>
                  <div>
                    <span className={styles.muted}>Название магазина</span>
                    <p>{sellerProfile.storeName}</p>
                  </div>
                  <div>
                    <span className={styles.muted}>Статус</span>
                    <p>{sellerProfile.status}</p>
                  </div>
                  <div>
                    <span className={styles.muted}>Телефон</span>
                    <p>{sellerProfile.phone}</p>
                  </div>
                  <div>
                    <span className={styles.muted}>Город</span>
                    <p>{sellerProfile.city}</p>
                  </div>
                  <div>
                    <span className={styles.muted}>Категория</span>
                    <p>{sellerProfile.referenceCategory}</p>
                  </div>
                  <div>
                    <span className={styles.muted}>Позиция в каталоге</span>
                    <p>{sellerProfile.catalogPosition}</p>
                  </div>
                </div>
              ) : (
                <p className={styles.muted}>Профиль продавца не найден.</p>
              )}
              <p className={styles.muted}>Редактирование профиля доступно через форму подключения продавца.</p>
            </div>
              )}

              {isModalOpen && (
            <SellerProductModal
              product={activeProduct}
              onClose={() => setIsModalOpen(false)}
              onSubmit={handleSaveProduct}
            />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};
