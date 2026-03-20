import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { api } from '../shared/api';
import { ordersApi } from '../shared/api/ordersApi';
import { normalizeApiError } from '../shared/api/client';
import { useSellerContext } from '../hooks/seller/useSellerContext';
import { useHeaderMenuStore } from '../app/store/headerMenuStore';
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
import { BottomNav } from '../widgets/layout/BottomNav';
import { CdekPvzPickerModal } from '../components/checkout/CdekPvzPickerModal';
import { getExternalDeliveryStatusLabel } from '../shared/lib/deliveryStatus';
import {
  SellerProductModal,
  SellerProductPayload
} from '../widgets/seller/SellerProductModal';
import styles from './SellerAccountPage.module.css';

const menuItems = [
  'Подключение',
  'Сводка',
  'Товары',
  'Заказы',
  'Бухгалтерия',
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
const formatMoney = (value: number, currency = 'RUB') =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value);
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);


const HANDOFF_STATUSES = new Set<OrderStatus>(['HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED']);

const isHandoverToDelivery = (order: Order) => {
  const orderStatus = String(order.status ?? '').toUpperCase();
  const shipmentStatus = String(order.shipment?.status ?? '').toUpperCase();
  return (
    HANDOFF_STATUSES.has(orderStatus as OrderStatus) ||
    ['IN_TRANSIT', 'DELIVERED', 'RETURNED'].includes(shipmentStatus)
  );
};


const getSellerOrderDisplayStatus = (order: Order) => {
  const isPaid =
    Boolean(order.paidAt) ||
    ['PAID', 'READY_FOR_SHIPMENT', 'PRINTING', 'HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED'].includes(order.status);

  if (!isPaid) return 'Ожидает оплаты';

  const handoverStarted = isHandoverToDelivery(order);
  if (handoverStarted) {
    return getExternalDeliveryStatusLabel(order.cdekStatus ?? order.shipment?.status ?? null);
  }

  if (!order.isPacked) return 'Ожидает упаковки';

  return 'Готов к отгрузке';
};

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
  const location = useLocation();

  const [activeItem, setActiveItem] =
    useState<(typeof menuItems)[number]>('Сводка');
  const isMenuOpen = useHeaderMenuStore((state) => state.isSellerMenuOpen);
  const closeSellerMenu = useHeaderMenuStore((state) => state.closeSellerMenu);

  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersView, setOrdersView] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [orderUpdateError, setOrderUpdateError] = useState<string | null>(null);

  const [labelDownloaded, setLabelDownloaded] = useState<Record<string, boolean>>({});
  const [actDownloaded, setActDownloaded] = useState<Record<string, boolean>>({});

  const [kycSubmission, setKycSubmission] =
    useState<SellerKycSubmission | null>(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [isKycSubmitting, setIsKycSubmitting] = useState(false);
  const [kycMessage, setKycMessage] = useState<string | null>(null);
  const [kycError, setKycError] = useState<string | null>(null);
  const [agreementsAccepted, setAgreementsAccepted] = useState(false);

  const [merchantForm, setMerchantForm] = useState({
    contactName: '',
    contactPhone: '',
    representativeName: '',
    legalName: '',
    inn: '',
    ogrn: ''
  });

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  // === Delivery profile ===
  const [dropoffPvzId, setDropoffPvzId] = useState('');
  const [dropoffPvzAddress, setDropoffPvzAddress] = useState('');
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
    ИП: ['contactName', 'contactPhone', 'inn', 'ogrn'],
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

  const kycSubmitDisabledReason = isKycPending
    ? 'Заявка уже находится на проверке.'
    : !hasDropoffPvz
        ? 'Выберите точку отгрузки (обязательно).'
        : !hasMerchantData
          ? 'Заполните обязательные поля продавца.'
          : !agreementsAccepted
            ? 'Подтвердите согласие с правилами сервиса.'
          : null;


  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.innerWidth > 960 && isMenuOpen) {
      closeSellerMenu();
    }

    const handleResize = () => {
      if (window.innerWidth > 960) {
        closeSellerMenu();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [closeSellerMenu, isMenuOpen]);

  useEffect(() => {
    closeSellerMenu();
  }, [closeSellerMenu, location.pathname, location.search]);

  useEffect(() => () => {
    closeSellerMenu();
  }, [closeSellerMenu]);

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
        setProductsError('Добавление товаров станет доступно после подтверждения профиля продавца.');
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
    } catch (error) {
      setOrders([]);
      setOrdersView([]);
      if (isAccessError(error) && isSellerReady) {
        setOrdersError('Раздел временно недоступен. Попробуйте обновить страницу.');
      } else if (isSellerReady) {
        setOrdersError('Не удалось загрузить заказы.');
      }
    } finally {
      setOrdersLoading(false);
    }
  }, [isSellerReady, userId]);
  const loadKyc = useCallback(async () => {
    setKycLoading(true);
    setKycError(null);
    try {
      const response = await api.getSellerKyc();
      setKycSubmission(response.data);
    } catch (error) {
      setKycSubmission(null);
      if (isAccessError(error) && isSellerReady) {
        setKycError('Проверьте доступ к кабинету продавца и попробуйте снова.');
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
        setPaymentsError('Не удалось загрузить бухгалтерию. Попробуйте ещё раз.');
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
        ogrn: sellerProfile.ogrn ?? prev.ogrn ?? ''
      }));
    }
  }, [sellerProfile?.id, sellerProfile?.contactName, sellerProfile?.contactPhone, sellerProfile?.representativeName, sellerProfile?.legalName, sellerProfile?.inn, sellerProfile?.ogrn, sellerProfile?.phone]);

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

  const handleKycSubmit = async () => {
    if (!isSellerReady) {
      setKycMessage('Подключите профиль продавца, чтобы отправить заявку.');
      return;
    }
    if (!hasDropoffPvz) {
      setKycError('Выберите точку отгрузки перед отправкой.');
      return;
    }

    setKycMessage(null);
    setKycError(null);
    setIsKycSubmitting(true);

    try {
      const status = sellerProfile?.status ?? 'ИП';
      const merchantPayload: Record<string, string> = {
        contactName: merchantForm.contactName.trim(),
        contactPhone: merchantForm.contactPhone.trim(),
        inn: merchantForm.inn.trim()
      };

      if (merchantForm.representativeName.trim()) merchantPayload.representativeName = merchantForm.representativeName.trim();
      if (merchantForm.legalName.trim()) merchantPayload.legalName = merchantForm.legalName.trim();
      if (status === 'ООО') {
        merchantPayload.representativeName = merchantForm.representativeName.trim() || merchantForm.contactName.trim();
        merchantPayload.legalName = merchantForm.legalName.trim();
        merchantPayload.ogrn = merchantForm.ogrn.trim();
      }
      if (status === 'ИП') merchantPayload.ogrn = merchantForm.ogrn.trim();

      const response = await api.submitSellerKyc({
        merchantData: merchantPayload as {
          contactName: string;
          contactPhone: string;
          representativeName?: string;
          legalName?: string;
          inn: string;
          ogrn?: string;
        },
        dropoffPvzId: dropoffPvzId.trim(),
        dropoffPvzMeta: {
          addressFull: dropoffPvzAddress.trim() || dropoffPvzId.trim(),
          provider: 'CDEK'
        },
        acceptedRules: agreementsAccepted,
        acceptedPersonalData: agreementsAccepted,
        acceptedRulesSlug: 'seller-delivery-and-store-rules',
        acceptedPersonalDataSlug: 'privacy-policy'
      });

      setKycSubmission(response.data);
      setKycMessage('Заявка отправлена на проверку.');
      await reload();
    } catch (error) {
      const normalized = normalizeApiError(error);
      const payload = (error as { payload?: { error?: { code?: string; message?: string } } })?.payload;
      const code = payload?.error?.code ?? normalized.code;
      if (isAccessError(error)) {
        setKycError('Проверьте доступ к кабинету продавца и попробуйте снова.');
      } else if (code === 'DROP_OFF_PVZ_REQUIRED') {
        setKycError('Выберите точку отгрузки.');
      } else if (code === 'MERCHANT_DATA_VALIDATION_ERROR') {
        setKycError(payload?.error?.message ?? 'Проверьте данные продавца.');
      } else if (code === 'CONSENT_REQUIRED') {
        setKycError(payload?.error?.message ?? 'Подтвердите согласие с правилами сервиса.');
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
        setProductsError('Добавление товаров станет доступно после подтверждения профиля продавца.');
      } else {
        setKycMessage('Загрузка товаров доступна после одобрения KYC.');
      }
    }
  };


  const handleSaveDeliveryProfile = async () => {
    setDeliverySettingsMessage(null);
    setDeliverySettingsError(null);

    const selectedPvzId = dropoffPvzId.trim();

    if (!selectedPvzId) {
      setDeliverySettingsError('Выберите точку отгрузки.');
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

      setDeliverySettingsMessage('Точка отгрузки сохранена.');
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
      setDeliverySettingsMessage('Точка отгрузки сохранена.');
      setDropoffModalOpen(false);
    } catch (error) {
      const normalized = normalizeApiError(error);
      setDeliverySettingsError(normalized.message ?? 'Не удалось сохранить пункт приёма.');
    }
  };


  const handleTogglePacked = async (order: Order) => {
    setOrderUpdateError(null);

    try {
      await api.updateOrderFulfillmentSteps(order.id, {
        isPacked: !order.isPacked
      });
      await loadOrders();
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.code === 'PAYMENT_REQUIRED') {
        setOrderUpdateError('Заказ не оплачен.');
        return;
      }
      setOrderUpdateError('Не удалось обновить отметку упаковки.');
    }
  };

  const handleReadyToShip = async (orderId: string) => {
    setOrderUpdateError(null);

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
    }
  };

  const handleSyncShipment = async (order: Order) => {
    setOrderUpdateError(null);
    const shipmentId = order.shipment?.id;
    const cdekOrderId = String(order.cdekOrderId ?? '').trim();

    if (!shipmentId && !cdekOrderId) {
      setOrderUpdateError('Синхронизация доступна после создания shipment.');
      return;
    }

    try {
      if (shipmentId) {
        await ordersApi.syncShipment(shipmentId);
      } else {
        await ordersApi.syncCdekOrder(order.id);
      }
      await loadOrders();
    } catch {
      setOrderUpdateError('Не удалось синхронизировать отправление CDEK.');
    }
  };

  const handleDownloadLabel = async (_shipmentId: string, orderId: string) => {
    setOrderUpdateError(null);

    try {
      const result = await ordersApi.downloadShippingLabel(orderId);

      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shipping-label-${orderId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setLabelDownloaded((prev) => ({ ...prev, [orderId]: true }));
    } catch {
      setOrderUpdateError('Не удалось скачать ярлык.');
    }
  };

  const handleDownloadAct = async (shipmentId: string, orderId: string) => {
    setOrderUpdateError(null);
    try {
      const blob = await api.downloadShipmentAct(shipmentId) as unknown as Blob;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cdek-act-${orderId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setActDownloaded((prev) => ({ ...prev, [orderId]: true }));
    } catch {
      setOrderUpdateError('Не удалось скачать акт.');
    }
  };






  const financeSummary = useMemo(() => {
    const available = payments
      .filter((payment) => ['PAID', 'SUCCESS', 'SUCCEEDED', 'COMPLETED'].includes(String(payment.status).toUpperCase()))
      .reduce((sum, payment) => sum + payment.amount, 0);
    const inProcessing = payments
      .filter((payment) => ['PENDING', 'PROCESSING', 'READY'].includes(String(payment.status).toUpperCase()))
      .reduce((sum, payment) => sum + payment.amount, 0);
    const frozen = orders
      .filter((order) => order.payoutStatus === 'HOLD')
      .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.lineTotal, 0), 0);
    const released = orders
      .filter((order) => order.payoutStatus === 'RELEASED' || order.payoutStatus === 'PAID')
      .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.lineTotal, 0), 0);

    return { available, frozen, released, inProcessing };
  }, [orders, payments]);



  const paymentStatusLabel = (status: string) => {
    switch (String(status).toUpperCase()) {
      case 'PAID':
      case 'SUCCESS':
      case 'SUCCEEDED':
      case 'COMPLETED':
        return 'Выплачено';
      case 'READY':
      case 'PROCESSING':
        return 'Готовится к выплате';
      case 'PENDING':
        return 'В обработке';
      default:
        return status;
    }
  };


  const payoutLabel = (status?: string | null) => {
    switch (String(status ?? '').toUpperCase()) {
      case 'PAID':
      case 'RELEASED':
        return 'Выплачено';
      case 'HOLD':
      case 'BLOCKED':
        return 'Удерживается';
      case 'PENDING':
      case 'PROCESSING':
        return 'В обработке';
      default:
        return '—';
    }
  };

  const summary = useMemo(() => {
    const revenue = orders.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.lineTotal, 0),
      0
    );
    const statusCounts = statusFlow.reduce((acc, status) => {
      acc[status] = orders.filter((order) => order.status === status).length;
      return acc;
    }, {} as Record<OrderStatus, number>);

    return {
      totalOrders: orders.length,
      totalProducts: products.length,
      revenue,
      statusCounts
    };
  }, [orders, products]);

  const readyToShipDisabledReason = (order: Order) => {
    if (!hasDropoffPvz) return 'Сначала выберите точку отгрузки.';
    if (!order.isPacked) return 'Сначала отметьте упаковку заказа.';
    if (!order.paidAt && order.status !== 'PAID') return 'Дождитесь оплаты заказа.';
    return null;
  };

  const hasSummaryData = summary.totalOrders > 0 || summary.totalProducts > 0;

  const financeOperations = useMemo(() => {
    const payoutOperations = payments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.createdAt,
      type: 'Выплата',
      orderId: payment.orderId,
      amount: payment.amount,
      status: paymentStatusLabel(payment.status),
      currency: payment.currency
    }));

    const holdOperations = orders
      .filter((order) => order.payoutStatus === 'HOLD' || order.payoutStatus === 'BLOCKED' || order.payoutStatus === 'RELEASED' || order.payoutStatus === 'PAID')
      .map((order) => ({
        id: `order-${order.id}`,
        date: order.createdAt,
        type: order.payoutStatus === 'HOLD' ? 'Заморозка' : order.payoutStatus === 'BLOCKED' ? 'Блокировка' : 'Разблокировка',
        orderId: order.id,
        amount: order.items.reduce((sum, item) => sum + item.lineTotal, 0),
        status: payoutLabel(order.payoutStatus),
        currency: 'RUB'
      }));

    return [...payoutOperations, ...holdOperations]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12);
  }, [orders, payments]);

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
        {isMenuOpen && (
          <button
            type="button"
            aria-label="Закрыть меню"
            className={styles.sidebarOverlay}
            onClick={closeSellerMenu}
          />
        )}
        <aside
          id="seller-sidebar"
          className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}
        >
          <div className={styles.sidebarHeader}>
            <h2>Кабинет продавца</h2>
            <button
              type="button"
              className={styles.closeMenu}
              onClick={closeSellerMenu}
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
                  closeSellerMenu();
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
            subtitle={activeItem === 'Сводка' ? 'Ключевые показатели, заказы и статус подключения продавца.' : 'Управляйте данными продавца и следите за операциями без лишних переходов.'}
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
                      <p>Заполните данные продавца, выберите точку отгрузки и прикрепите документы одним отправлением.</p>
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
                        <p>Укажите только обязательные данные для подключения продавца.</p>
                      </div>
                      <fieldset disabled={isKycPending || isKycSubmitting} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: '12px' }}>
                      <div className={styles.settingsGrid}>
                        <label className={`${styles.labelBlock} ${styles.disabledField}`}>
                          Контактное лицо (ФИО)
                          <input
                            value={merchantForm.contactName}
                            readOnly
                            disabled
                            placeholder="Иванов Иван Иванович"
                          />
                        </label>
                        <label className={`${styles.labelBlock} ${styles.disabledField}`}>
                          Телефон
                          <input
                            value={merchantForm.contactPhone}
                            readOnly
                            disabled
                            placeholder="+7 (999) 123-45-67"
                          />
                        </label>
                        <p className={styles.helperText}>Для смены контактной информации обратитесь в поддержку.</p>
                        {(sellerProfile?.status === 'ООО' || sellerProfile?.status === 'Самозанятый') && (
                          <label className={styles.labelBlock}>
                            Официальное название
                            <input
                              value={merchantForm.legalName}
                              onChange={(e) => setMerchantForm((p) => ({ ...p, legalName: e.target.value }))}
                              placeholder={sellerProfile?.status === 'Самозанятый' ? 'Самозанятый Иванов И. И.' : 'ООО «Название»'}
                            />
                          </label>
                        )}
                        <label className={styles.labelBlock}>
                          ИНН
                          <input
                            value={merchantForm.inn}
                            onChange={(e) => setMerchantForm((p) => ({ ...p, inn: e.target.value.replace(/\D/g, '').slice(0, sellerProfile?.status === 'ООО' ? 10 : 12) }))}
                            placeholder={sellerProfile?.status === 'ООО' ? '10 цифр' : '12 цифр'}
                          />
                        </label>
                        {(sellerProfile?.status === 'ООО' || sellerProfile?.status === 'ИП') && (
                          <label className={styles.labelBlock}>
                            ОГРН{sellerProfile?.status === 'ИП' ? 'ИП' : ''}
                            <input
                              value={merchantForm.ogrn}
                              onChange={(e) => setMerchantForm((p) => ({ ...p, ogrn: e.target.value.replace(/\D/g, '').slice(0, sellerProfile?.status === 'ИП' ? 15 : 13) }))}
                              placeholder={sellerProfile?.status === 'ИП' ? '15 цифр' : '13 цифр'}
                            />
                          </label>
                        )}
                      </div>
                      <div className={styles.sectionHeader}>
                        <h3>Точка отгрузки</h3>
                      </div>

                      <div className={styles.settingsGrid}>
                        <div>
                          <span className={styles.muted}>Точка отгрузки</span>
                          <p>{hasDropoffPvz ? 'Выбрана' : 'Пока не выбрана'}</p>
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

                      <div className={styles.settingsGrid}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={agreementsAccepted}
                            onChange={(e) => setAgreementsAccepted(e.target.checked)}
                          />
                          <span>Принимаю <a href="/offer" target="_blank" rel="noreferrer">оферту</a>, <a href="/service-rules" target="_blank" rel="noreferrer">правила сервиса</a> и <a href="/privacy-policy" target="_blank" rel="noreferrer">политику персональных данных</a></span>
                        </label>
                      </div>

                      <div className={styles.kycActions}>
                        <Button
                          type="button"
                          onClick={handleKycSubmit}
                          disabled={Boolean(kycSubmitDisabledReason) || isKycSubmitting}
                        >
                          {isKycSubmitting ? 'Отправка...' : 'Отправить на проверку'}
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
                      <p>Отслеживайте выполнение и документы доставки.</p>
                    </div>
                  </div>

                  {ordersLoading ? (
                    <p className={styles.muted}>Загрузка заказов...</p>
                  ) : ordersError ? (
                    <p className={styles.error}>{ordersError}</p>
                  ) : ordersView.length === 0 ? (
                    <p className={styles.muted}>Заказов пока нет.</p>
                  ) : (
                    <div className={styles.ordersList}>
                      {ordersView.map((order) => {
                        const displayStatus = getSellerOrderDisplayStatus(order);
                        const total = order.items.reduce(
                          (sum, item) => sum + item.lineTotal,
                          0
                        );

                        return (
                          <div key={order.id} className={styles.orderCard}>
                            <div className={styles.orderCardTop}>
                              <div className={styles.orderCardLeft}>
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
                              </div>

                              <div className={styles.orderCardRight}>
                                <p className={styles.orderAmount}>
                                  {formatCurrency(total)} ₽
                                </p>
                                <div className={styles.orderPayoutSummary}>
                                  <span className={styles.orderPayoutLabel}>Получит продавец</span>
                                  <strong>{formatMoney(total)}</strong>
                                </div>
                                <p className={styles.muted}>Статус: {displayStatus}</p>
                              </div>
                            </div>

                            <div className={styles.deliveryInputs}>
                              <p className={styles.muted}>
                                Способ доставки: ПВЗ (Pickup Point)
                              </p>
                              <p className={styles.muted}>
                                Пункт выдачи: {order.buyerPickupPvzMeta?.addressFull ?? '—'}
                              </p>
                              <p className={styles.muted}>
                                Пункт сдачи: {order.sellerDropoffPvzId || dropoffPvzId || '—'}
                              </p>
                              <div className={styles.orderFinanceMeta}>
                                <p className={styles.muted}>
                                  Выплата: {payoutLabel(order.payoutStatus)}
                                </p>
                                <p className={styles.muted}>
                                  Сумма продавца: {formatMoney(total)}
                                </p>
                              </div>
                              <p className={styles.muted}>
                                Статус доставки:{' '}
                                {displayStatus}
                                {order.shipment?.lastSyncAt
                                  ? ` · обновлено ${new Date(
                                    order.shipment.lastSyncAt
                                  ).toLocaleString('ru-RU')}`
                                  : ''}
                              </p>

                              <p className={styles.muted}>
                                Трек-номер: {order.trackingNumber ?? '—'}
                              </p>

                              <Button
                                type="button"
                                variant={order.isPacked ? 'ghost' : 'secondary'}
                                onClick={() => handleTogglePacked(order)}
                                disabled={!order.paidAt && order.status !== 'PAID'}
                              >
                                {order.isPacked ? 'Снять отметку упаковки' : 'Отметить упаковку'}
                              </Button>

                              {!order.shipment?.id ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => handleReadyToShip(order.id)}
                                    disabled={Boolean(readyToShipDisabledReason(order))}
                                  >
                                    Готов к отгрузке
                                  </Button>
                                  {readyToShipDisabledReason(order) && (
                                    <p className={styles.muted}>
                                      {readyToShipDisabledReason(order)}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleSyncShipment(order)}
                                  disabled={!order.shipment?.id && !order.cdekOrderId}
                                >
                                  Синхронизировать CDEK
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
                                className={labelDownloaded[order.id] ? styles.downloadedButton : ''}
                                onClick={() => order.shipment?.id && handleDownloadLabel(order.shipment.id, order.id)}
                                disabled={!order.shipment?.id || !order.trackingNumber}
                              >
                                Скачать ярлык
                              </Button>

                              {!order.trackingNumber && <p className={styles.muted}>ещё формируется</p>}

                              <Button
                                type="button"
                                variant="ghost"
                                className={actDownloaded[order.id] ? styles.downloadedButton : ''}
                                onClick={() => order.shipment?.id && handleDownloadAct(order.shipment.id, order.id)}
                                disabled={!order.shipment?.id && !order.cdekOrderId}
                              >
                                Скачать акт
                              </Button>
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


              {activeItem === 'Бухгалтерия' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p>Следите за выплатами и операциями без лишних переходов.</p>
                    </div>
                  </div>

                  <div className={styles.financeSummaryGrid}>
                    <SellerStatsCard title="Доступно" value={formatMoney(financeSummary.available)} />
                    <SellerStatsCard title="Заморожено" value={formatMoney(financeSummary.frozen)} />
                    <SellerStatsCard title="Выплачено" value={formatMoney(financeSummary.released)} />
                    <SellerStatsCard title="В обработке" value={formatMoney(financeSummary.inProcessing)} />
                  </div>

                  {paymentsLoading ? (
                    <p className={styles.muted}>Загрузка финансовых операций...</p>
                  ) : paymentsError ? (
                    <p className={styles.error}>{paymentsError}</p>
                  ) : financeOperations.length === 0 ? (
                    <div className={styles.infoCard}>
                      <h3>История операций пока пуста</h3>
                      <p className={styles.muted}>Здесь появятся поступления, выплаты и удержания по заказам.</p>
                    </div>
                  ) : (
                    <div className={styles.ordersTable}>
                      <div className={styles.financeTableHeader}>
                        <span>Дата</span>
                        <span>Тип операции</span>
                        <span>Заказ</span>
                        <span>Сумма</span>
                        <span>Статус</span>
                      </div>
                      {financeOperations.map((operation) => (
                        <div key={operation.id} className={styles.financeTableRow}>
                          <span>{formatDate(operation.date)}</span>
                          <span>{operation.type}</span>
                          <span className={styles.cellTruncate}>№{operation.orderId}</span>
                          <span>{formatMoney(operation.amount, operation.currency)}</span>
                          <span>{operation.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeItem === 'Поддержка' && (
                <div className={styles.section}>
                  <div className={styles.infoCard}>
                    <h3>Поддержка Print-Form</h3>
                    <p className={styles.muted}>Если нужна помощь по подключению, товарам или доставке, откройте чат с поддержкой в разделе «Чаты».</p>
                    <Button type="button" variant="secondary" onClick={() => navigate('/account?tab=chats')}>
                      Перейти в чаты
                    </Button>
                  </div>
                </div>
              )}

              {activeItem === 'Настройки' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p>Основные настройки магазина и точки отгрузки.</p>
                    </div>
                  </div>

                  {sellerProfile ? (
                    <div className={styles.settingsGrid}>
                      <div>
                        <span className={styles.muted}>Название магазина</span>
                        <p>{sellerProfile.storeName || sellerProfile.contactName || 'Магазин продавца'}</p>
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
                    </div>
                  ) : (
                    <p className={styles.muted}>Профиль продавца не найден.</p>
                  )}

                  <div className={styles.settingsGrid}>
                    <div>
                      <span className={styles.muted}>Точка отгрузки</span>
                      <p>{dropoffPvzId || 'Пока не выбрана'}</p>
                      {dropoffPvzAddress ? <p className={styles.muted}>{dropoffPvzAddress}</p> : null}
                      <div className={styles.inlineActions}>
                        <Button type="button" variant="secondary" onClick={() => setDropoffModalOpen(true)}>
                          Выбрать на карте
                        </Button>
                      </div>
                    </div>
                  </div>

                  <p className={styles.muted}>Точка нужна для оформления отгрузки и документов доставки.</p>

                  <Button type="button" onClick={handleSaveDeliveryProfile} disabled={!dropoffPvzId.trim()}>
                    Сохранить точку отгрузки
                  </Button>

                  {deliverySettingsMessage && <p className={styles.muted}>{deliverySettingsMessage}</p>}
                  {deliverySettingsError && <p className={styles.error}>{deliverySettingsError}</p>}
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
      <BottomNav forceShow onNavigate={closeSellerMenu} />
    </section>
  );
};
