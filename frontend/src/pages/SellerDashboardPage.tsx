import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { api } from '../shared/api';
import { ordersApi } from '../shared/api/ordersApi';
import { normalizeApiError } from '../shared/api/client';
import { useSellerContext } from '../hooks/seller/useSellerContext';
import {
  Order,
  OrderStatus,
  Payment,
  Product,
  SellerKycSubmission
} from '../shared/types';
import { Button } from '../shared/ui/Button';
import { SellerActions } from '../components/seller/SellerActions';
import { SellerErrorState } from '../components/seller/SellerErrorState';
import { SellerHeader } from '../components/seller/SellerHeader';
import { SellerStatsCard } from '../components/seller/SellerStatsCard';
import { CdekPvzPickerModal } from '../components/checkout/CdekPvzPickerModal';
import {
  SellerProductModal,
  SellerProductPayload
} from '../widgets/seller/SellerProductModal';
import styles from './SellerAccountPage.module.css';
import { getExternalDeliveryStatusLabel } from '../shared/lib/deliveryStatus';

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

const statusFlow: OrderStatus[] = [
  'CREATED',
  'PRINTING',
  'HANDED_TO_DELIVERY',
  'IN_TRANSIT',
  'DELIVERED'
];

const statusLabels: Partial<Record<OrderStatus, string>> = {
  CREATED: 'Создается',
  PAID: 'Оплачен',
  READY_FOR_SHIPMENT: 'Готов к отгрузке',
  PRINTING: 'Модель печатается',
  HANDED_TO_DELIVERY: 'Передано в доставку',
  IN_TRANSIT: 'В пути',
  DELIVERED: 'Доставлено',
  CANCELLED: 'Отменен',
  RETURNED: 'Возврат',
  EXPIRED: 'Просрочен'
};

const formatCurrency = (value: number) => value.toLocaleString('ru-RU');
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

type TrackingResult = { trackingNumber?: string; state?: string };

const isAccessError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('forbidden') ||
    message.includes('unauthorized') ||
    message.includes('401') ||
    message.includes('403')
  );
};


export const SellerDashboardPage = () => {
  const navigate = useNavigate();

  const [activeItem, setActiveItem] =
    useState<(typeof menuItems)[number]>('Сводка');
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
  const [orderUpdateError, setOrderUpdateError] = useState<string | null>(null);
  const [documentErrors, setDocumentErrors] = useState<Record<string, { label?: string; act?: string }>>({});
  const [readyLoadingByOrder, setReadyLoadingByOrder] = useState<Record<string, boolean>>({});
  const [refreshLoadingByOrder, setRefreshLoadingByOrder] = useState<Record<string, boolean>>({});
  const [labelLoadingByOrder, setLabelLoadingByOrder] = useState<Record<string, boolean>>({});
  const [actLoadingByOrder, setActLoadingByOrder] = useState<Record<string, boolean>>({});
  const [trackingSearch, setTrackingSearch] = useState('');
  const [trackingResult, setTrackingResult] = useState<TrackingResult | null>(null);

  const [kycSubmission, setKycSubmission] =
    useState<SellerKycSubmission | null>(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [isKycSubmitting, setIsKycSubmitting] = useState(false);
  const [kycMessage, setKycMessage] = useState<string | null>(null);
  const [kycError, setKycError] = useState<string | null>(null);
  const [acceptRules, setAcceptRules] = useState(false);
  const [acceptPersonalData, setAcceptPersonalData] = useState(false);
  const [consentsTouched, setConsentsTouched] = useState(false);

  const [merchantForm, setMerchantForm] = useState({
    contactName: '',
    contactPhone: '',
    representativeName: '',
    legalName: '',
    inn: '',
    ogrn: '',
    legalAddressFull: ''
  });

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  // === Delivery profile ===
  const [dropoffPvzId, setDropoffPvzId] = useState('');
  const [dropoffPvzAddress, setDropoffPvzAddress] = useState('');
  const [dropoffSchedule, setDropoffSchedule] = useState<'DAILY' | 'WEEKDAYS'>('WEEKDAYS');
  const [isDropoffModalOpen, setDropoffModalOpen] = useState(false);

  const [deliverySettingsMessage, setDeliverySettingsMessage] = useState<
    string | null
  >(null);
  const [deliverySettingsError, setDeliverySettingsError] = useState<
    string | null
  >(null);

  const canSell = kycSubmission?.status === 'APPROVED';
  const userId = useAuthStore((state) => state.user?.id);

  const {
    authStatus,
    status: contextStatus,
    context,
    error: sellerContextError,
    reload
  } = useSellerContext();

  const sellerProfile = context?.profile ?? null;

  const isSellerReady =
    authStatus === 'authorized' &&
    contextStatus === 'success' &&
    Boolean(sellerProfile);

  const isAuthLoading = authStatus === 'loading' || contextStatus === 'loading';

  const hasDropoffPvz = Boolean(dropoffPvzId.trim());

  const requiredMerchantFieldsByStatus: Record<string, string[]> = {
    ООО: ['contactName', 'contactPhone', 'legalName', 'inn', 'ogrn'],
    ИП: ['contactName', 'contactPhone', 'legalName', 'inn', 'ogrn'],
    Самозанятый: ['contactName', 'contactPhone', 'legalName', 'inn']
  };
  const hasMerchantData = (() => {
    if (!sellerProfile) return false;
    const required = requiredMerchantFieldsByStatus[sellerProfile.status] ?? requiredMerchantFieldsByStatus['ИП'];
    return required.every((field) => {
      const v = (merchantForm as unknown as Record<string, unknown>)[field];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
  })();

  const isKycPending = kycSubmission?.status === 'PENDING';
  const areConsentsAccepted = acceptRules && acceptPersonalData;

  const kycSubmitDisabledReason = isKycPending
    ? 'Заявка уже находится на проверке.'
    : !hasDropoffPvz
      ? 'Выберите точку отгрузки (обязательно).'
      : !hasMerchantData
        ? 'Заполните обязательные поля продавца.'
        : !areConsentsAccepted
          ? 'Примите обязательные согласия.'
          : null;

  useEffect(() => {
    if (!sellerContextError) return;

    if (
      sellerContextError.code === 'SELLER_PROFILE_MISSING' ||
      sellerContextError.status === 409
    ) {
      navigate('/seller/onboarding', { replace: true });
      return;
    }

    if (
      sellerContextError.status === 403 ||
      sellerContextError.code === 'FORBIDDEN'
    ) {
      navigate('/', { replace: true });
    }
  }, [navigate, sellerContextError]);

  const loadProducts = useCallback(async () => {
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
  }, [isSellerReady]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);

    try {
      if (!userId || !isSellerReady) {
        setOrders([]);
        setOrdersView([]);
        return;
      }

      const data = await ordersApi.listBySeller(userId);
      setOrders(data);

      setOrdersView(data);

      const profileResponse = await api.getSellerDeliveryProfile();
      const dropoffPvz = profileResponse.data?.dropoffPvz;
      const dropoffMeta = profileResponse.data?.defaultDropoffPvzMeta;
      const selectedPvzId = dropoffPvz?.pvzId ?? profileResponse.data?.defaultDropoffPvzId ?? '';
      setDropoffPvzId(selectedPvzId);
      setDropoffPvzAddress(dropoffPvz?.addressFull ?? dropoffMeta?.addressFull ?? '');
      setDropoffSchedule(profileResponse.data?.dropoffSchedule === 'DAILY' ? 'DAILY' : 'WEEKDAYS');
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
  }, [isSellerReady, userId]);

  const loadOrdersByStatus = useCallback(
    async (status: OrderStatus | 'ALL') => {
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
    },
    [isSellerReady, orders, userId]
  );

  const loadKyc = useCallback(async () => {
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
  }, [isSellerReady]);

  const loadPayments = useCallback(async () => {
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
  }, [isSellerReady]);

  useEffect(() => {
    if (sellerProfile) {
      setMerchantForm((prev) => ({
        ...prev,
        contactName: sellerProfile.contactName ?? prev.contactName ?? '',
        contactPhone: sellerProfile.contactPhone ?? sellerProfile.phone ?? prev.contactPhone ?? '',
        representativeName: sellerProfile.representativeName ?? prev.representativeName ?? '',
        legalName: sellerProfile.legalName ?? prev.legalName ?? '',
        inn: sellerProfile.inn ?? prev.inn ?? '',
        ogrn: sellerProfile.ogrn ?? prev.ogrn ?? '',
        legalAddressFull: sellerProfile.legalAddressFull ?? prev.legalAddressFull ?? ''
      }));
      setAcceptRules(Boolean(sellerProfile.acceptedRulesAt));
      setAcceptPersonalData(Boolean(sellerProfile.acceptedPersonalDataAt));
    }
  }, [sellerProfile]);

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
    if (userId) void loadOrders();
  }, [isSellerReady, loadKyc, loadOrders, loadPayments, loadProducts, userId]);

  useEffect(() => {
    if (!isSellerReady) {
      setOrdersView([]);
      return;
    }

    if (statusFilter === 'ALL') {
      setOrdersView(orders);
      return;
    }

    void loadOrdersByStatus(statusFilter);
  }, [isSellerReady, loadOrdersByStatus, orders, statusFilter]);

  const handleKycSubmit = async () => {
    if (!isSellerReady) {
      setKycMessage('Подключите профиль продавца, чтобы отправить документы.');
      return;
    }
    if (!hasDropoffPvz) {
      setKycError('Выберите точку отгрузки перед отправкой.');
      return;
    }
    if (!areConsentsAccepted) {
      setConsentsTouched(true);
      setKycError('Примите обязательные согласия перед отправкой.');
      return;
    }

    setKycMessage(null);
    setKycError(null);
    setConsentsTouched(true);
    setIsKycSubmitting(true);

    try {
      const status = sellerProfile?.status ?? 'ИП';
      const merchantPayload: Record<string, string> = {
        contactName: merchantForm.contactName.trim(),
        contactPhone: merchantForm.contactPhone.trim(),
        representativeName: merchantForm.representativeName.trim() || merchantForm.contactName.trim(),
        legalName: merchantForm.legalName.trim(),
        legalAddressFull: merchantForm.legalAddressFull.trim(),
        inn: merchantForm.inn.trim()
      };

      if (status === 'ООО' || status === 'ИП') merchantPayload.ogrn = merchantForm.ogrn.trim();

      const response = await api.submitSellerKyc({
        merchantData: merchantPayload as {
          contactName: string;
          contactPhone: string;
          representativeName?: string;
          legalAddressFull?: string;
          legalName: string;
          inn: string;
          ogrn?: string;
        },
        dropoffPvzId: dropoffPvzId.trim(),
        dropoffPvzMeta: {
          addressFull: dropoffPvzAddress.trim() || dropoffPvzId.trim(),
          provider: 'CDEK'
        },
        files: [],
        acceptedRules: acceptRules,
        acceptedPersonalData: acceptPersonalData
      });

      setKycSubmission(response.data);
      setKycMessage('Заявка отправлена на проверку.');
      await reload();
    } catch (error) {
      const normalized = normalizeApiError(error);
      const payload = (error as { payload?: { error?: { code?: string; message?: string } } })?.payload;
      const code = payload?.error?.code ?? normalized.code;
      if (isAccessError(error)) {
        setKycError('Сессия истекла, войдите снова.');
      } else if (code === 'DROP_OFF_PVZ_REQUIRED') {
        setKycError('Выберите точку отгрузки (обязательно).');
      } else if (code === 'CONSENT_REQUIRED') {
        setKycError(payload?.error?.message ?? 'Необходимо принять обязательные согласия.');
      } else if (code === 'MERCHANT_DATA_VALIDATION_ERROR') {
        setKycError(payload?.error?.message ?? 'Проверьте данные продавца.');
      } else if (code === 'KYC_DOCS_REQUIRED') {
        setKycError(payload?.error?.message ?? 'Загрузите достаточно документов.');
      } else {
        setKycError(normalized.message ?? 'Не удалось отправить на проверку.');
      }
    } finally {
      setIsKycSubmitting(false);
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



  const handleSaveDropoffSchedule = async () => {
    setDeliverySettingsMessage(null);
    setDeliverySettingsError(null);

    try {
      await api.updateSellerDeliveryProfile({ dropoffSchedule });
      setDeliverySettingsMessage('График сдачи сохранён.');
    } catch (error) {
      const normalized = normalizeApiError(error);
      setDeliverySettingsError(normalized.message ?? 'Не удалось сохранить график сдачи.');
    }
  };

  const handleSaveDeliveryProfile = async () => {
    setDeliverySettingsMessage(null);
    setDeliverySettingsError(null);

    const selectedPvzId = dropoffPvzId.trim();

    if (!selectedPvzId) {
      setDeliverySettingsError('Выберите пункт приёма в списке.');
      return;
    }

    try {
      await api.updateSellerDropoffPvz({
        dropoffPvz: {
          pvzId: selectedPvzId
        }
      });

      const profileResponse = await api.getSellerDeliveryProfile();
      const syncedPvzId = profileResponse.data?.dropoffPvz?.pvzId ?? profileResponse.data?.defaultDropoffPvzId ?? selectedPvzId;
      const dropoffMeta = profileResponse.data?.defaultDropoffPvzMeta;
      const metaAddress =
        dropoffMeta && typeof dropoffMeta === 'object'
          ? String((dropoffMeta as Record<string, unknown>).addressFull ?? '')
          : '';

      setDropoffPvzId(syncedPvzId);
      setDropoffPvzAddress(metaAddress || dropoffPvzAddress);

      setDeliverySettingsMessage('Пункт приёма сохранён.');
    } catch (error) {
      const normalized = normalizeApiError(error);
      setDeliverySettingsError(normalized.message ?? 'Не удалось сохранить пункт приёма.');
    }
  };

  const handleDropoffSelect = async (selection: { pvzId?: string | null; id?: string | null; addressFull?: string; provider?: string; raw?: unknown;[key: string]: unknown }) => {
    setDeliverySettingsMessage(null);
    setDeliverySettingsError(null);

    const selectedId = selection.pvzId ?? selection.id ?? null;
    const canContinue = typeof selectedId === 'string' && selectedId.trim().length > 0;

    if (!canContinue) {
      setDeliverySettingsError('Не удалось определить pvzId выбранной точки. Выберите другой пункт.');
      return;
    }

    try {
      await api.updateSellerDropoffPvz({
        dropoffPvz: {
          pvzId: selectedId,
          provider: (selection.provider as string) ?? 'CDEK',
          addressFull: selection.addressFull,
          raw: selection.raw
        }
      });

      setDropoffPvzId(selectedId);
      setDropoffPvzAddress(selection.addressFull ?? '');
      setDeliverySettingsMessage('Пункт приёма сохранён.');
      setDropoffModalOpen(false);
    } catch (error) {
      const normalized = normalizeApiError(error);
      setDeliverySettingsError(normalized.message ?? 'Не удалось сохранить пункт приёма.');
    }
  };

  const handleReadyToShip = async (orderId: string) => {
    if (readyLoadingByOrder[orderId]) return;
    setOrderUpdateError(null);
    setReadyLoadingByOrder((prev) => ({ ...prev, [orderId]: true }));

    try {
      await ordersApi.readyToShip(orderId);
      await loadOrders();
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.code === 'PAYMENT_REQUIRED') {
        setOrderUpdateError('Заказ не оплачен.');
        return;
      }
      if (normalized.code === 'SELLER_DROPOFF_REQUIRED') {
        setOrderUpdateError('Не выбран ПВЗ сдачи продавца.');
        return;
      }
      if (normalized.code === 'BUYER_PICKUP_REQUIRED') {
        setOrderUpdateError('Не выбран ПВЗ покупателя.');
        return;
      }
      setOrderUpdateError(
        'Не удалось создать заявку доставки. Проверьте точку отгрузки и данные ПВЗ.'
      );
    } finally {
      setReadyLoadingByOrder((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleManualSync = async (order: Order) => {
    const shipmentId = order.shipment?.id;
    if (!shipmentId || refreshLoadingByOrder[order.id]) return;

    setOrderUpdateError(null);
    setRefreshLoadingByOrder((prev) => ({ ...prev, [order.id]: true }));
    setDocumentErrors((prev) => ({ ...prev, [order.id]: { ...prev[order.id], label: undefined, act: undefined } }));

    try {
      await ordersApi.syncShipment(shipmentId);
      await loadOrders();
    } catch (error) {
      setOrderUpdateError(normalizeApiError(error).message || 'Не удалось обновить данные доставки.');
    } finally {
      setRefreshLoadingByOrder((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePackingToggle = async (order: Order, isPacked: boolean) => {
    try {
      await ordersApi.updateSellerFulfillmentSteps(order.id, { isPacked });
      await loadOrders();
    } catch (error) {
      setOrderUpdateError(normalizeApiError(error).message || 'Не удалось обновить упаковку.');
    }
  };

  const handleDownloadLabel = async (order: Order) => {
    if (labelLoadingByOrder[order.id]) return;
    setOrderUpdateError(null);
    setLabelLoadingByOrder((prev) => ({ ...prev, [order.id]: true }));
    setDocumentErrors((prev) => ({ ...prev, [order.id]: { ...prev[order.id], label: undefined } }));

    try {
      const blob = await ordersApi.downloadSellerDocument(order.id, 'label');
      triggerDownload(blob, `cdek-label-${order.id}.pdf`);
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.code === 'FORMS_NOT_READY') {
        setDocumentErrors((prev) => ({ ...prev, [order.id]: { ...prev[order.id], label: 'Документы ещё формируются. Нажмите «Обновить» позже.' } }));
        return;
      }
      setDocumentErrors((prev) => ({ ...prev, [order.id]: { ...prev[order.id], label: 'Ошибка документа' } }));
    } finally {
      setLabelLoadingByOrder((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const handleDownloadAct = async (order: Order) => {
    if (actLoadingByOrder[order.id]) return;
    setOrderUpdateError(null);
    setActLoadingByOrder((prev) => ({ ...prev, [order.id]: true }));
    setDocumentErrors((prev) => ({ ...prev, [order.id]: { ...prev[order.id], act: undefined } }));
    try {
      const blob = await ordersApi.downloadSellerDocument(order.id, 'handover-act');
      triggerDownload(blob, `cdek-act-${order.id}.pdf`);
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.code === 'FORMS_NOT_READY') {
        setDocumentErrors((prev) => ({ ...prev, [order.id]: { ...prev[order.id], act: 'Документы ещё формируются. Нажмите «Обновить» позже.' } }));
        return;
      }
      setDocumentErrors((prev) => ({ ...prev, [order.id]: { ...prev[order.id], act: 'Ошибка документа' } }));
    } finally {
      setActLoadingByOrder((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const handleTrackingSearch = async () => {
    if (!trackingSearch.trim()) return;
    try {
      const response = await api.findShipmentByTracking(trackingSearch.trim());
      setTrackingResult(response.data);
    } catch {
      setTrackingResult(null);
      setOrderUpdateError('Отправление по трек-номеру не найдено.');
    }
  };

  const payoutLabel = (value?: string | null) => {
    if (value === 'PAID') return 'PAID';
    if (
      value === 'RELEASED' ||
      value === 'READY_TO_PAYOUT' ||
      value === 'READY'
    )
      return 'READY';
    return 'HOLD до получения';
  };

  const latestPaymentsByOrder = useMemo(() => {
    const byOrder = new Map<string, Payment>();
    for (const payment of payments) {
      const existing = byOrder.get(payment.orderId);
      if (!existing || new Date(payment.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        byOrder.set(payment.orderId, payment);
      }
    }
    return byOrder;
  }, [payments]);

  const isOrderPaid = (order: Order) =>
    Boolean(order.paidAt) || latestPaymentsByOrder.get(order.id)?.status === 'SUCCEEDED';

  const hasShipment = (order: Order) => Boolean(order.cdekOrderId || order.shipment?.id);
  const isShipmentInvalid = (order: Order) => order.shipment?.isValid === false || order.shipment?.status === 'FAILED';

  const canDownloadLabel = (order: Order) => {
    const needsManualRefresh = hasPendingManualRefresh(order);
    if (isShipmentInvalid(order)) return false;
    return isOrderPaid(order) && hasShipment(order) && order.status !== 'CANCELLED' && !needsManualRefresh && getFormsStatus(order) === 'READY';
  };
  const canDownloadAct = (order: Order) => {
    const needsManualRefresh = hasPendingManualRefresh(order);
    if (isShipmentInvalid(order)) return false;
    return isOrderPaid(order) && hasShipment(order) && order.status !== 'CANCELLED' && !needsManualRefresh && getFormsStatus(order) === 'READY';
  };
  const canReadyToShip = (order: Order) => {
    const isNotTerminal = order.status !== 'CANCELLED' && order.status !== 'DELIVERED';
    return isOrderPaid(order) && Boolean(order.isPacked) && isNotTerminal && order.status !== 'HANDED_TO_DELIVERY';
  };

  const readyToShipDisabledReason = (order: Order) => {
    if (order.status === 'CANCELLED') return 'Отменённый заказ нельзя передать в отгрузку';
    if (order.status === 'DELIVERED') return 'Доставленный заказ нельзя передать в отгрузку';
    if (order.status === 'HANDED_TO_DELIVERY') return 'Уже передано в доставку';
    if (!isOrderPaid(order)) return 'Ожидает оплаты';
    if (!order.isPacked) return 'Отметьте шаг «Упаковка»';
    return null;
  };

  const getFormsStatus = (order: Order): 'NOT_REQUESTED' | 'FORMING' | 'READY' => {
    if (!hasShipment(order)) return 'NOT_REQUESTED';
    if (isShipmentInvalid(order)) return 'NOT_REQUESTED';
    return order.shipment?.formsStatus ?? 'FORMING';
  };

  const hasPendingManualRefresh = (order: Order) => {
    if (isShipmentInvalid(order)) return false;
    const readyAt = order.readyForShipmentAt;
    const manualSyncAt = order.shipment?.lastManualSyncAt;
    if (!readyAt) return false;
    if (!manualSyncAt) return true;
    return new Date(manualSyncAt).getTime() < new Date(readyAt).getTime();
  };

  const documentsStatusText = (order: Order) => {
    if (!hasShipment(order)) return 'Документы: не запрошены';
    if (isShipmentInvalid(order)) return 'Ошибка оформления доставки';
    if (hasPendingManualRefresh(order)) return 'Документы: формируются';
    if (getFormsStatus(order) === 'READY') return 'Документы: готовы';
    return 'Документы: формируются';
  };

  const getOrderDeliveryLabel = (order: Order) => {
    if (!isOrderPaid(order)) return 'Ожидает оплаты';
    if (order.status === 'HANDED_TO_DELIVERY') {
      return getExternalDeliveryStatusLabel(order.cdekStatus ?? order.shipment?.status ?? null);
    }
    return statusLabels[order.status] ?? 'В работе';
  };
  const summary = useMemo(() => {
    const totalProducts = products.length;
    const totalOrders = orders.length;

    const revenue = orders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((itemSum, item) => itemSum + item.lineTotal, 0),
      0
    );

    const statusCounts = statusFlow.reduce<Record<OrderStatus, number>>(
      (acc, status) => {
        acc[status] = orders.filter((order) => order.status === status).length;
        return acc;
      },
      {} as Record<OrderStatus, number>
    );

    return { totalProducts, totalOrders, revenue, statusCounts };
  }, [orders, products.length]);

  const reportRows = useMemo(() => {
    const days = 14;
    const now = new Date();

    return Array.from({ length: days }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (days - 1 - index));
      const dateKey = date.toISOString().split('T')[0];

      const ordersForDay = orders.filter((order) =>
        order.createdAt.startsWith(dateKey)
      );

      const revenue = ordersForDay.reduce(
        (sum, order) =>
          sum +
          order.items.reduce((itemSum, item) => itemSum + item.lineTotal, 0),
        0
      );

      return {
        date: date.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit'
        }),
        orders: ordersForDay.length,
        revenue
      };
    });
  }, [orders]);

  const hasSummaryData = summary.totalOrders > 0 || summary.totalProducts > 0;

  const logisticsOrders = orders.filter(
    (order) => order.trackingNumber || order.carrier || order.shippingAddress
  );

  const shouldShowSellerError =
    authStatus === 'authorized' &&
    contextStatus === 'error' &&
    sellerContextError &&
    sellerContextError.code !== 'SELLER_PROFILE_MISSING' &&
    sellerContextError.status !== 409 &&
    sellerContextError.status !== 403 &&
    sellerContextError.code !== 'FORBIDDEN';

  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <aside
          className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''
            }`}
        >
          <div className={styles.sidebarHeader}>
            <h2>Кабинет продавца</h2>
            <button
              type="button"
              className={styles.closeMenu}
              onClick={() => setIsMenuOpen(false)}
            >
              ✕
            </button>
          </div>

          <nav className={styles.menu}>
            {menuItems.map((item) => (
              <button
                key={item}
                type="button"
                className={
                  item === activeItem ? styles.menuItemActive : styles.menuItem
                }
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
          <SellerHeader
            title={activeItem}
            onMenuOpen={() => setIsMenuOpen(true)}
          />

          {isAuthLoading && (
            <div className={styles.section}>
              <p className={styles.muted}>Загрузка...</p>
            </div>
          )}

          {authStatus === 'unauthorized' && (
            <div className={styles.section}>
              <div className={styles.infoCard}>
                <h2>Войдите в аккаунт</h2>
                <p className={styles.muted}>
                  Авторизуйтесь, чтобы получить доступ к кабинету продавца.
                </p>
                <Link
                  className={styles.linkButton}
                  to="/auth/login?redirectTo=/seller"
                >
                  Войти
                </Link>
              </div>
            </div>
          )}

          {shouldShowSellerError && sellerContextError && (
            <SellerErrorState message={sellerContextError.message} />
          )}

          {isSellerReady && (
            <>
              {activeItem === 'Сводка' && (
                <div className={styles.section}>
                  <div className={styles.statsGrid}>
                    <SellerStatsCard
                      title="Заказы"
                      value={`${summary.totalOrders} всего`}
                    />
                    <SellerStatsCard
                      title="Выручка"
                      value={`${formatCurrency(summary.revenue)} ₽`}
                    />
                    <SellerStatsCard
                      title="Товары"
                      value={`${summary.totalProducts} в каталоге`}
                    />
                  </div>

                  {!hasSummaryData && (
                    <p className={styles.muted}>Данных пока нет.</p>
                  )}

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
                      <h2>Подключение продавца</h2>
                      <p>Заполните данные продавца и выберите точку отгрузки.</p>
                    </div>
                  </div>

                  {kycLoading ? (
                    <p className={styles.muted}>Загрузка статуса...</p>
                  ) : (
                    <div className={styles.kycPanel}>
                      <div className={styles.kycRow}>
                        <span className={styles.kycLabel}>Статус:</span>
                        <strong>
                          {kycSubmission?.status ?? 'Не отправлено'}
                        </strong>
                      </div>

                      {(kycSubmission?.comment ||
                        kycSubmission?.moderationNotes ||
                        kycSubmission?.notes) && (
                          <p className={styles.kycNotes}>
                            Комментарий:{' '}
                            {kycSubmission.comment ?? kycSubmission.moderationNotes ?? kycSubmission.notes}
                          </p>
                        )}

                      <div className={styles.sectionHeader}>
                        <h3>Данные продавца</h3>
                        <p>Укажите только обязательные данные для логистики и выплат.</p>
                      </div>
                      <fieldset disabled={isKycPending || isKycSubmitting} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: '12px' }}>
                        <div className={styles.settingsGrid}>
                          <label className={styles.labelBlock}>
                            Телефон для связи
                            <input
                              value={merchantForm.contactPhone}
                              onChange={(e) => setMerchantForm((p) => ({ ...p, contactPhone: e.target.value }))}
                              placeholder="+7 (999) 123-45-67"
                            />
                          </label>
                          <label className={styles.labelBlock}>
                            ФИО представителя
                            <input
                              value={merchantForm.contactName}
                              onChange={(e) =>
                                setMerchantForm((p) => ({ ...p, contactName: e.target.value, representativeName: e.target.value }))
                              }
                              placeholder="Иванов Иван Иванович"
                            />
                          </label>
                          <label className={styles.labelBlock}>
                            Официальное название продавца
                            <input
                              value={merchantForm.legalName}
                              onChange={(e) => setMerchantForm((p) => ({ ...p, legalName: e.target.value }))}
                              placeholder={sellerProfile?.status === 'ИП' ? 'ИП Фамилия И. О.' : 'ООО «Название»'}
                            />
                          </label>
                          <label className={styles.labelBlock}>
                            ИНН
                            <input
                              value={merchantForm.inn}
                              onChange={(e) =>
                                setMerchantForm((p) => ({ ...p, inn: e.target.value.replace(/\D/g, '').slice(0, sellerProfile?.status === 'ООО' ? 10 : 12) }))
                              }
                              placeholder={sellerProfile?.status === 'ООО' ? '10 цифр' : '12 цифр'}
                            />
                          </label>
                          {(sellerProfile?.status === 'ООО' || sellerProfile?.status === 'ИП') && (
                            <label className={styles.labelBlock}>
                              ОГРН{sellerProfile?.status === 'ИП' ? 'ИП' : ''}
                              <input
                                value={merchantForm.ogrn}
                                onChange={(e) =>
                                  setMerchantForm((p) => ({ ...p, ogrn: e.target.value.replace(/\D/g, '').slice(0, sellerProfile?.status === 'ИП' ? 15 : 13) }))
                                }
                                placeholder={sellerProfile?.status === 'ИП' ? '15 цифр' : '13 цифр'}
                              />
                            </label>
                          )}
                          <label className={styles.labelBlock}>
                            Город
                            <input value={sellerProfile?.city ?? ''} readOnly />
                          </label>
                          <label className={styles.labelBlock} style={{ gridColumn: '1 / -1' }}>
                            Юридический адрес (опционально)
                            <input
                              value={merchantForm.legalAddressFull}
                              onChange={(e) => setMerchantForm((p) => ({ ...p, legalAddressFull: e.target.value }))}
                              placeholder="Улица, дом, офис"
                            />
                          </label>
                        </div>
                        <div className={styles.sectionHeader}>
                          <h3>Точка отгрузки</h3>
                        </div>

                        <div className={styles.settingsGrid}>
                          <div>
                            <span className={styles.muted}>Выбранный dropoffPvzId</span>
                            <p>{hasDropoffPvz ? dropoffPvzId : 'Не выбрана'}</p>
                            {dropoffPvzAddress ? <p className={styles.muted}>{dropoffPvzAddress}</p> : null}
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => setDropoffModalOpen(true)}
                              disabled={isKycPending}
                            >
                              Выбрать на карте
                            </Button>
                          </div>
                        </div>

                        <div className={styles.consentsBlock}>
                          <label className={styles.checkboxRow}>
                            <input
                              type="checkbox"
                              checked={acceptRules}
                              onChange={(event) => setAcceptRules(event.target.checked)}
                              disabled={isKycPending || isKycSubmitting}
                            />
                            <span>
                              Я принимаю <Link to="/returns">правила доставки и правила магазина</Link>
                            </span>
                          </label>
                          <label className={styles.checkboxRow}>
                            <input
                              type="checkbox"
                              checked={acceptPersonalData}
                              onChange={(event) => setAcceptPersonalData(event.target.checked)}
                              disabled={isKycPending || isKycSubmitting}
                            />
                            <span>
                              Я согласен(на) на <Link to="/privacy-policy">обработку персональных данных</Link>
                            </span>
                          </label>
                          {consentsTouched && !areConsentsAccepted && (
                            <p className={styles.error}>Для отправки нужно принять оба согласия.</p>
                          )}
                        </div>

                        <div className={styles.kycActions}>
                          <Button
                            type="button"
                            onClick={handleKycSubmit}
                            disabled={Boolean(kycSubmitDisabledReason) || isKycSubmitting}
                          >
                            Отправить на проверку
                          </Button>

                          {isKycPending && <p className={styles.kycMessage}>На проверке</p>}
                        </div>

                        {kycSubmitDisabledReason && <p className={styles.muted}>{kycSubmitDisabledReason}</p>}
                      </fieldset>
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
                      <p>
                        Создавайте и редактируйте карточки с описанием и фото.
                      </p>
                    </div>

                    <SellerActions
                      canSell={canSell}
                      onAddProduct={() => {
                        setActiveProduct(null);
                        setIsModalOpen(true);
                      }}
                    />
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
                              {product.moderationStatus === 'NEEDS_EDIT' &&
                                product.moderationNotes && (
                                  <span className={styles.moderationNote}>
                                    {product.moderationNotes}
                                  </span>
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
                          onChange={(event) =>
                            setStatusFilter(
                              event.target.value as OrderStatus | 'ALL'
                            )
                          }
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
                        const total = order.items.reduce(
                          (sum, item) => sum + item.lineTotal,
                          0
                        );

                        return (
                          <div key={order.id} className={styles.ordersRow}>
                            <div className={styles.cellTruncate}>
                              <strong>№{order.id}</strong>
                              <p className={styles.muted}>
                                {formatDate(order.createdAt)}
                              </p>
                            </div>

                            <div className={styles.cellTruncate}>
                              <p>
                                {order.contact?.name ??
                                  order.buyer?.name ??
                                  '—'}
                              </p>
                              <p className={styles.muted}>
                                {order.contact?.phone ??
                                  order.buyer?.email ??
                                  ''}
                              </p>
                            </div>

                            <div>{formatCurrency(total)} ₽</div>

                            <div>
                              <strong>{getOrderDeliveryLabel(order)}</strong>
                            </div>

                            <div className={styles.deliveryInputs}>
                              <p className={styles.muted}>
                                Упаковка: {order.isPacked ? 'выполнено' : 'не выполнено'}
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => void handlePackingToggle(order, !Boolean(order.isPacked))}
                                disabled={order.status === 'CANCELLED' || !isOrderPaid(order)}
                              >
                                {order.isPacked ? 'Снять отметку упаковки' : 'Отметить упаковку'}
                              </Button>
                              <p className={styles.muted}>
                                Способ доставки: ПВЗ (CDEK)
                              </p>
                              <p className={styles.muted}>
                                Пункт выдачи: {order.buyerPickupPvzMeta?.addressFull ?? '—'}
                              </p>
                              <p className={styles.muted}>
                                Пункт сдачи: {order.sellerDropoffPvzId || dropoffPvzId || '—'}
                              </p>
                              <p className={styles.muted}>
                                Выплата: {payoutLabel(order.payoutStatus)}
                              </p>
                              <p className={styles.muted}>
                                Статус доставки:{' '}
                                {getOrderDeliveryLabel(order)}
                                {order.shipment?.lastSyncAt
                                  ? ` · обновлено ${new Date(
                                    order.shipment.lastSyncAt
                                  ).toLocaleString('ru-RU')}`
                                  : ''}
                              </p>

                              <p className={styles.muted}>
                                Трек-номер: {order.trackingNumber ?? '—'}
                              </p>

                              <p className={styles.muted}>{documentsStatusText(order)}</p>
                              {isShipmentInvalid(order) && (
                                <p className={styles.error}>
                                  {order.shipment?.errorMessage || 'Тариф CDEK недоступен для выбранного направления'}
                                </p>
                              )}
                              {hasPendingManualRefresh(order) && (
                                <p className={styles.muted}>Документы ещё формируются. Нажмите «Обновить» позже.</p>
                              )}

                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => void handleReadyToShip(order.id)}
                                disabled={
                                  !canReadyToShip(order) || Boolean(readyLoadingByOrder[order.id])
                                }
                              >
                                {readyLoadingByOrder[order.id] ? 'Отправка…' : 'Готов к отгрузке'}
                              </Button>
                              {readyToShipDisabledReason(order) && (
                                  <p className={styles.muted}>
                                    {readyToShipDisabledReason(order)}
                                  </p>
                                )}

                              {hasShipment(order) && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => void handleManualSync(order)}
                                  disabled={Boolean(refreshLoadingByOrder[order.id])}
                                >
                                  {refreshLoadingByOrder[order.id] ? 'Обновляем…' : 'Обновить'}
                                </Button>
                              )}

                              <details>
                                <summary>Данные для доставки</summary>
                                <p className={styles.muted}>
                                  ФИО: {order.recipientName ?? '—'}
                                </p>
                                <p className={styles.muted}>
                                  Телефон: {order.recipientPhone ?? '—'}
                                </p>
                                <p className={styles.muted}>
                                  Email: {order.recipientEmail ?? '—'}
                                </p>
                                <p className={styles.muted}>
                                  ПВЗ покупателя:{' '}
                                  {order.buyerPickupPvzMeta?.addressFull ?? '—'}
                                </p>
                                <p className={styles.muted}>
                                  ПВЗ сдачи:{' '}
                                  {order.sellerDropoffPvzMeta?.addressFull ??
                                    '—'}
                                </p>
                                <p className={styles.muted}>
                                  Грузомест: {order.packagesCount ?? 1}
                                </p>
                                <p className={styles.muted}>
                                  Сумма: {formatCurrency(total)} ₽
                                </p>
                                <p className={styles.muted}>
                                  Товары:{' '}
                                  {order.items
                                    .map((item) => `${item.title} ×${item.qty}`)
                                    .join(', ') || '—'}
                                </p>
                              </details>

                              <Button
                                type="button"
                                variant="ghost"
                                className={order.isLabelPrinted ? styles.documentPrintedButton : undefined}
                                onClick={() => void handleDownloadLabel(order)}
                                disabled={!canDownloadLabel(order) || Boolean(labelLoadingByOrder[order.id])}
                              >
                                {labelLoadingByOrder[order.id] ? 'Скачивание…' : 'Скачать ярлык'}
                              </Button>
                              {documentErrors[order.id]?.label && <p className={styles.error}>{documentErrors[order.id]?.label}</p>}

                              <Button
                                type="button"
                                variant="ghost"
                                className={order.isActPrinted ? styles.documentPrintedButton : undefined}
                                onClick={() => void handleDownloadAct(order)}
                                disabled={!canDownloadAct(order) || Boolean(actLoadingByOrder[order.id])}
                              >
                                {actLoadingByOrder[order.id] ? 'Скачивание…' : 'Скачать акт'}
                              </Button>
                              {documentErrors[order.id]?.act && <p className={styles.error}>{documentErrors[order.id]?.act}</p>}

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {orderUpdateError && (
                    <p className={styles.error}>{orderUpdateError}</p>
                  )}
                </div>
              )}

              {activeItem === 'Логистика' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2>Логистика</h2>
                      <p>Данные по доставке ваших заказов.</p>
                    </div>
                    <div>
                      <input
                        className={styles.input}
                        placeholder="Поиск по трек-номеру"
                        value={trackingSearch}
                        onChange={(e) => setTrackingSearch(e.target.value)}
                      />
                      <Button type="button" variant="secondary" onClick={handleTrackingSearch}>
                        Найти
                      </Button>
                      {trackingResult && (
                        <p className={styles.muted}>
                          {trackingResult.trackingNumber} · {getExternalDeliveryStatusLabel(trackingResult.state)}
                        </p>
                      )}
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
                          <div className={styles.cellTruncate}>
                            <strong>№{order.id}</strong>
                            <p className={styles.muted}>
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <div className={styles.cellTruncate}>
                            {order.shippingAddress?.addressText ?? '—'}
                          </div>
                          <div>{statusLabels[order.status]}</div>
                          <div className={styles.cellTruncate}>
                            <p>{order.trackingNumber ?? '—'}</p>
                            <p className={styles.muted}>
                              {order.carrier ?? '—'}
                            </p>
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
                    <p className={styles.muted}>
                      Данные о выплатах пока отсутствуют.
                    </p>
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
                          <span className={styles.cellTruncate}>
                            №{payment.orderId}
                          </span>
                          <span>
                            {formatCurrency(payment.amount)} {payment.currency}
                          </span>
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

                  <p className={styles.muted}>
                    Редактирование профиля доступно через форму подключения
                    продавца.
                  </p>


                  <div className={styles.settingsGrid}>
                    <label>
                      <span className={styles.muted}>Сдаю заказы</span>
                      <select
                        className={styles.input}
                        value={dropoffSchedule}
                        onChange={(event) => setDropoffSchedule(event.target.value as 'DAILY' | 'WEEKDAYS')}
                      >
                        <option value="DAILY">Ежедневно</option>
                        <option value="WEEKDAYS">По будням</option>
                      </select>
                    </label>
                    <div>
                      <Button type="button" variant="secondary" onClick={() => void handleSaveDropoffSchedule()}>
                        Сохранить график сдачи
                      </Button>
                    </div>
                  </div>

                  <div className={styles.settingsGrid}>
                    <div>
                      <span className={styles.muted}>
                        Пункт приёма (C2C dropoff)
                      </span>
                      <p>
                        {dropoffPvzId || 'Не определена'}
                      </p>

                      {dropoffPvzAddress ? (
                        <p className={styles.muted}>{dropoffPvzAddress}</p>
                      ) : null}

                      <div className={styles.inlineActions}>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setDropoffModalOpen(true)}
                        >
                          Выбрать пункт приёма (как физлицо)
                        </Button>
                      </div>

                      {dropoffPvzId ? (
                        <p className={styles.muted}>
                          Пункт приёма: {dropoffPvzId}
                          {dropoffPvzAddress ? ` (${dropoffPvzAddress})` : ''}
                        </p>
                      ) : (
                        <p className={styles.muted}>Пункт приёма не выбран.</p>
                      )}

                      {deliverySettingsError && (
                        <p className={styles.error} style={{ marginTop: '0.5rem' }}>
                          {deliverySettingsError}
                        </p>
                      )}

                    </div>
                  </div>

                  <p className={styles.muted}>
                    Используется для создания заявок CDEK для отгрузки в ПВЗ.
                  </p>

                  <Button
                    type="button"
                    onClick={handleSaveDeliveryProfile}
                    disabled={!dropoffPvzId.trim()}
                  >
                    Сохранить пункт приёма
                  </Button>


                  {deliverySettingsMessage && (
                    <p className={styles.muted}>{deliverySettingsMessage}</p>
                  )}
                  {deliverySettingsError && (
                    <p className={styles.error}>{deliverySettingsError}</p>
                  )}
                </div>
              )}

              <CdekPvzPickerModal
                isOpen={isDropoffModalOpen}
                onClose={() => setDropoffModalOpen(false)}
                onSelect={(selection) => {
                  void handleDropoffSelect({
                    pvzId: selection.pvzCode,
                    id: selection.pvzCode,
                    addressFull: selection.addressFull,
                    provider: 'CDEK',
                    raw: selection.raw
                  });
                }}
              />

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
