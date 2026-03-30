import { TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { EmptyState } from '../shared/ui/EmptyState';
import { SellerActions } from '../components/seller/SellerActions';
import { SellerErrorState } from '../components/seller/SellerErrorState';
import { SellerHeader } from '../components/seller/SellerHeader';
import { SellerStatsCard } from '../components/seller/SellerStatsCard';
import { BottomNav } from '../widgets/layout/BottomNav';
import { CdekPvzPickerModal } from '../components/checkout/CdekPvzPickerModal';
import { getExternalDeliveryStatusLabel } from '../shared/lib/deliveryStatus';
import { normalizeSellerType } from '../shared/lib/sellerType';
import {
  getModerationStatusLabelRu,
  getModerationStatusTone
} from '../shared/lib/productModeration';
import {
  SellerProductModal,
  SellerProductPayload
} from '../widgets/seller/SellerProductModal';
import { formatPrice } from '../shared/lib/formatPrice';
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

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

const formatCountdown = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const rest = Math.floor(safe % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${rest}`;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const firstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return '';
};

const toKopecks = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.round(value * 100);
};

const resolveOrderItemLineTotalKopecks = (item: Order['items'][number]) => {
  if (typeof item.lineTotalKopecks === 'number') return item.lineTotalKopecks;
  if (typeof item.lineTotal === 'number') return item.lineTotal;
  return toKopecks(item.lineTotalRubles);
};

const resolveOrderKopecks = (order: Order) => {
  if (typeof order.sellerNetAmount === 'number') return order.sellerNetAmount;
  if (typeof order.totalKopecks === 'number') return order.totalKopecks;
  if (typeof order.total === 'number') return order.total;
  return toKopecks(order.totalRubles);
};

const resolvePaymentKopecks = (payment: Payment) => {
  if (typeof payment.amountKopecks === 'number') return payment.amountKopecks;
  if (typeof payment.amount === 'number') return payment.amount;
  return toKopecks(payment.amountRubles);
};

const payoutStatusLabelRu = (value?: string | null) => {
  switch (String(value ?? '').toUpperCase()) {
    case 'HOLD':
      return 'Заморожено';
    case 'PAID_OUT':
    case 'RELEASED':
      return 'Выплачено';
    case 'PENDING':
      return 'В обработке';
    case 'BLOCKED':
      return 'Заблокировано / отменено';
    default:
      return 'В обработке';
  }
};

const HANDOFF_STATUSES = new Set<OrderStatus>([
  'HANDED_TO_DELIVERY',
  'IN_TRANSIT',
  'DELIVERED'
]);

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
    [
      'PAID',
      'READY_FOR_SHIPMENT',
      'PRINTING',
      'HANDED_TO_DELIVERY',
      'IN_TRANSIT',
      'DELIVERED'
    ].includes(order.status);

  if (!isPaid) return 'Ожидает оплаты';

  const handoverStarted = isHandoverToDelivery(order);
  if (handoverStarted) {
    return getExternalDeliveryStatusLabel(
      order.cdekStatus ?? order.shipment?.status ?? null
    );
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
  const toggleSellerMenu = useHeaderMenuStore((state) => state.toggleSellerMenu);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [productActionMessage, setProductActionMessage] = useState<
    string | null
  >(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersView, setOrdersView] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [orderUpdateError, setOrderUpdateError] = useState<string | null>(null);

  const [labelDownloaded, setLabelDownloaded] = useState<
    Record<string, boolean>
  >({});
  const [actDownloaded, setActDownloaded] = useState<Record<string, boolean>>(
    {}
  );

  const [kycSubmission, setKycSubmission] =
    useState<SellerKycSubmission | null>(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [isKycSubmitting, setIsKycSubmitting] = useState(false);
  const [kycMessage, setKycMessage] = useState<string | null>(null);
  const [kycError, setKycError] = useState<string | null>(null);
  const [acceptedRules, setAcceptedRules] = useState(false);

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
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;

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

  const sellerType = normalizeSellerType(sellerProfile?.sellerType);

  const requiredMerchantFieldsBySellerType = {
    ООО: ['contactName', 'contactPhone', 'legalName', 'inn', 'ogrn'],
    ИП: ['contactName', 'contactPhone', 'inn', 'ogrn'],
    Самозанятый: ['contactName', 'contactPhone', 'legalName', 'inn']
  } satisfies Record<
    'ООО' | 'ИП' | 'Самозанятый',
    Array<keyof typeof merchantForm>
  >;

  const merchantFieldLabelsBySellerType = {
    ООО: {
      contactName: 'контактное лицо',
      contactPhone: 'телефон',
      legalName: 'официальное название',
      inn: 'ИНН',
      ogrn: 'ОГРН'
    },
    ИП: {
      contactName: 'контактное лицо',
      contactPhone: 'телефон',
      inn: 'ИНН',
      ogrn: 'ОГРНИП'
    },
    Самозанятый: {
      contactName: 'контактное лицо',
      contactPhone: 'телефон',
      legalName: 'официальное название',
      inn: 'ИНН'
    }
  } satisfies Record<
    'ООО' | 'ИП' | 'Самозанятый',
    Partial<Record<keyof typeof merchantForm, string>>
  >;

  const requiredMerchantFields = sellerType
    ? requiredMerchantFieldsBySellerType[sellerType]
    : [];

  const missingMerchantFields = requiredMerchantFields.filter((field) => {
    const value = merchantForm[field];
    return typeof value !== 'string' || value.trim() === '';
  });

  const missingMerchantFieldLabels = sellerType
    ? missingMerchantFields.map((field) => {
        const labels = merchantFieldLabelsBySellerType[sellerType] as Partial<
          Record<keyof typeof merchantForm, string>
        >;
        return labels[field] ?? field;
      })
    : [];

  const hasMerchantData =
    Boolean(sellerType) && missingMerchantFields.length === 0;

  const isKycPending = kycSubmission?.status === 'PENDING';

  const kycSubmitDisabledReason = isKycPending
    ? 'Заявка уже находится на проверке.'
    : !sellerType
      ? 'Не удалось определить тип продавца. Обновите страницу и проверьте профиль.'
      : !hasDropoffPvz
        ? 'Выберите точку отгрузки, чтобы завершить подключение.'
        : !hasMerchantData
          ? `Заполните обязательные поля продавца: ${missingMerchantFieldLabels.join(', ')}.`
          : !acceptedRules
            ? 'Подтвердите согласие с документами.'
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

  useEffect(
    () => () => {
      closeSellerMenu();
    },
    [closeSellerMenu]
  );

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

  const handleDeleteProduct = useCallback(async (product: Product) => {
    const shouldDelete = window.confirm(
      'Удалить товар?\nТовар будет скрыт из каталога. Это действие нельзя просто отменить.'
    );
    if (!shouldDelete) return;

    try {
      await api.removeSellerProduct(product.id);
      setProducts((prev) => prev.filter((item) => item.id !== product.id));
      setProductActionMessage('Товар успешно удалён');
    } catch {
      setProductActionMessage('Не удалось удалить товар');
    }
  }, []);

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
      setOrdersView(
        data.filter(
          (order) =>
            !(
              order.paymentStatus === 'PAYMENT_EXPIRED' ||
              order.isExpired === true
            )
        )
      );

      const profileResponse = await api.getSellerDeliveryProfile();
      const dropoffPvz = profileResponse.data?.dropoffPvz;
      const dropoffMeta = profileResponse.data?.defaultDropoffPvzMeta;
      const selectedPvzId =
        dropoffPvz?.pvzId ?? profileResponse.data?.defaultDropoffPvzId ?? '';
      setDropoffPvzId(selectedPvzId);
      setDropoffPvzAddress(
        dropoffPvz?.addressFull ?? dropoffMeta?.addressFull ?? ''
      );
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

  useEffect(() => {
    if (!productActionMessage) return;
    const timer = window.setTimeout(() => setProductActionMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [productActionMessage]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setOrdersView((prev) =>
        prev.filter((order) => {
          if (order.paymentStatus !== 'PENDING') return true;
          if (order.isExpired) return false;
          if (
            typeof order.secondsUntilExpiry === 'number' &&
            order.secondsUntilExpiry <= 0
          ) {
            return false;
          }
          return true;
        })
      );

      setOrders((prev) =>
        prev.map((order) => {
          if (
            order.paymentStatus !== 'PENDING' ||
            typeof order.secondsUntilExpiry !== 'number'
          ) {
            return order;
          }
          const next = Math.max(0, order.secondsUntilExpiry - 1);
          return {
            ...order,
            secondsUntilExpiry: next,
            isExpired: next <= 0 ? true : order.isExpired
          };
        })
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);
  const loadKyc = useCallback(async () => {
    setKycLoading(true);
    setKycError(null);
    try {
      const response = await api.getSellerKyc();
      setKycSubmission(response.data);
    } catch (error) {
      setKycSubmission(null);
      if (isAccessError(error) && isSellerReady) {
        setKycError(
          'Не удалось отправить заявку. Попробуйте ещё раз чуть позже.'
        );
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
        setPaymentsError(
          'Не удалось загрузить операции. Попробуйте ещё раз чуть позже.'
        );
      }
    } finally {
      setPaymentsLoading(false);
    }
  }, [isSellerReady]);

  useEffect(() => {
    if (sellerProfile) {
      setMerchantForm((prev) => ({
        ...prev,
        contactName: firstNonEmpty(sellerProfile.contactName, prev.contactName),
        contactPhone: firstNonEmpty(
          sellerProfile.contactPhone,
          sellerProfile.phone,
          user?.phone,
          prev.contactPhone
        ),
        representativeName: firstNonEmpty(
          sellerProfile.representativeName,
          prev.representativeName
        ),
        legalName: firstNonEmpty(sellerProfile.legalName, prev.legalName),
        inn: firstNonEmpty(sellerProfile.inn, prev.inn),
        ogrn: firstNonEmpty(sellerProfile.ogrn, prev.ogrn)
      }));
    }
  }, [sellerProfile, user?.phone]);

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
      if (!sellerType) {
        setKycError(
          'Не удалось определить тип продавца. Обновите страницу и попробуйте снова.'
        );
        return;
      }
      const merchantPayload: Record<string, string> = {
        contactName: merchantForm.contactName.trim(),
        contactPhone: merchantForm.contactPhone.trim(),
        inn: merchantForm.inn.trim()
      };

      if (merchantForm.representativeName.trim())
        merchantPayload.representativeName =
          merchantForm.representativeName.trim();
      if (merchantForm.legalName.trim())
        merchantPayload.legalName = merchantForm.legalName.trim();
      if (sellerType === 'ООО') {
        merchantPayload.representativeName =
          merchantForm.representativeName.trim() ||
          merchantForm.contactName.trim();
        merchantPayload.legalName = merchantForm.legalName.trim();
        merchantPayload.ogrn = merchantForm.ogrn.trim();
      }
      if (sellerType === 'ИП') merchantPayload.ogrn = merchantForm.ogrn.trim();

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
        acceptedRules,
        acceptedPersonalData: acceptedRules,
        acceptedRulesSlug: 'seller-delivery-and-store-rules',
        acceptedPersonalDataSlug: 'privacy-policy'
      });

      setKycSubmission(response.data);
      setKycMessage('Заявка отправлена на проверку.');
      await reload();
    } catch (error) {
      const normalized = normalizeApiError(error);
      const payload = (
        error as { payload?: { error?: { code?: string; message?: string } } }
      )?.payload;
      const code = payload?.error?.code ?? normalized.code;
      if (isAccessError(error)) {
        setKycError(
          'Не удалось отправить заявку. Попробуйте ещё раз чуть позже.'
        );
      } else if (code === 'DROP_OFF_PVZ_REQUIRED') {
        setKycError('Выберите точку отгрузки (обязательно).');
      } else if (code === 'MERCHANT_DATA_VALIDATION_ERROR') {
        setKycError(payload?.error?.message ?? 'Проверьте данные продавца.');
      } else if (code === 'CONSENT_REQUIRED') {
        setKycError(
          payload?.error?.message ?? 'Подтвердите согласие с документами.'
        );
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
        setProductsError(
          'Не удалось загрузить товары. Попробуйте обновить страницу чуть позже.'
        );
      } else {
        setKycMessage(
          'Управление товарами станет доступно после подтверждения профиля продавца.'
        );
      }
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
      const syncedPvzId =
        profileResponse.data?.dropoffPvz?.pvzId ??
        profileResponse.data?.defaultDropoffPvzId ??
        selectedPvzId;
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
      setDeliverySettingsError(
        normalized.message ?? 'Не удалось сохранить пункт приёма.'
      );
    }
  };

  const handleDropoffSelect = async (selection: {
    pvzId?: string | null;
    id?: string | null;
    addressFull?: string;
    provider?: string;
    raw?: unknown;
    [key: string]: unknown;
  }) => {
    setDeliverySettingsMessage(null);
    setDeliverySettingsError(null);

    const selectedId = selection.pvzId ?? selection.id ?? null;
    const canContinue =
      typeof selectedId === 'string' && selectedId.trim().length > 0;

    if (!canContinue) {
      setDeliverySettingsError(
        'Не удалось определить pvzId выбранной точки. Выберите другой пункт.'
      );
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
      setDeliverySettingsError(
        normalized.message ?? 'Не удалось сохранить пункт приёма.'
      );
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
      const blob = (await api.downloadShipmentAct(
        shipmentId
      )) as unknown as Blob;
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

  const readyToShipDisabledReason = (order: Order) => {
    if (!order.paidAt && order.status !== 'PAID') return 'Ожидает оплаты';
    if (!order.isPacked) return 'Сначала отметьте упаковку';
    if (!order.sellerDropoffPvzMeta && !dropoffPvzId)
      return 'Не выбран ПВЗ сдачи';
    if (!order.buyerPickupPvzMeta && !order.shippingAddressId)
      return 'Не указан адрес доставки';
    if (order.shipment?.id) return 'Заявка уже создана';
    if (order.status === 'HANDED_TO_DELIVERY') return 'Уже передан в доставку';
    if (
      order.shipment?.status &&
      ['DELIVERED', 'CANCELLED', 'FAILED'].includes(order.shipment.status)
    ) {
      return 'Доставка завершена';
    }
    return null;
  };
  const summary = useMemo(() => {
    const totalProducts = products.length;
    const totalOrders = orders.length;

    const revenue = orders
      .filter(
        (order) =>
          order.status !== 'CANCELLED' &&
          order.paymentStatus !== 'REFUND_PENDING' &&
          order.paymentStatus !== 'REFUNDED'
      )
      .reduce((sum, order) => sum + resolveOrderKopecks(order), 0);

    const statusCounts = statusFlow.reduce<Record<OrderStatus, number>>(
      (acc, status) => {
        acc[status] = orders.filter((order) => order.status === status).length;
        return acc;
      },
      {} as Record<OrderStatus, number>
    );

    return { totalProducts, totalOrders, revenue, statusCounts };
  }, [orders, products.length]);

  const hasSummaryData = summary.totalOrders > 0 || summary.totalProducts > 0;

  const displayStoreName =
    (sellerProfile?.storeName ?? '').trim() ||
    (user?.fullName ?? user?.name ?? '').trim() ||
    'Магазин продавца';

  const financeSummary = useMemo(() => {
    const available = payments
      .filter((payment) =>
        ['PAID', 'SUCCESS', 'SUCCEEDED', 'COMPLETED'].includes(
          String(payment.status).toUpperCase()
        )
      )
      .reduce((sum, payment) => sum + resolvePaymentKopecks(payment), 0);
    const inProcessing = payments
      .filter((payment) =>
        ['PENDING', 'PROCESSING', 'READY'].includes(
          String(payment.status).toUpperCase()
        )
      )
      .reduce((sum, payment) => sum + resolvePaymentKopecks(payment), 0);
    const frozen = orders
      .filter(
        (order) =>
          String(order.payoutStatus ?? '').toUpperCase() === 'HOLD' ||
          String(order.yookassaDealStatus ?? '').toUpperCase() === 'HOLD'
      )
      .reduce((sum, order) => sum + resolveOrderKopecks(order), 0);
    const released = orders
      .filter(
        (order) =>
          ['RELEASED', 'PAID', 'PAID_OUT'].includes(
            String(order.payoutStatus ?? '').toUpperCase()
          )
      )
      .reduce((sum, order) => sum + resolveOrderKopecks(order), 0);

    return { available, frozen, released, inProcessing };
  }, [orders, payments]);

  const financeChartRows = useMemo(() => {
    const rows = Array.from({ length: 4 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (3 - index));
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const label = date.toLocaleDateString('ru-RU', { month: 'short' });

      const orderAmount = orders
        .filter(
          (order) =>
            order.status !== 'CANCELLED' &&
            order.paymentStatus !== 'REFUND_PENDING' &&
            order.paymentStatus !== 'REFUNDED'
        )
        .filter((order) => {
          const orderDate = new Date(order.createdAt);
          return (
            `${orderDate.getFullYear()}-${orderDate.getMonth()}` === monthKey
          );
        })
        .reduce((sum, order) => sum + resolveOrderKopecks(order), 0);

      const payoutAmount = payments
        .filter((payment) => {
          const paymentDate = new Date(payment.createdAt);
          return (
            `${paymentDate.getFullYear()}-${paymentDate.getMonth()}` ===
            monthKey
          );
        })
        .reduce((sum, payment) => sum + resolvePaymentKopecks(payment), 0);

      const frozenAmount = orders
        .filter(
          (order) =>
            String(order.payoutStatus ?? '').toUpperCase() === 'HOLD' ||
            String(order.yookassaDealStatus ?? '').toUpperCase() === 'HOLD'
        )
        .filter((order) => {
          const orderDate = new Date(order.createdAt);
          return (
            `${orderDate.getFullYear()}-${orderDate.getMonth()}` === monthKey
          );
        })
        .reduce((sum, order) => sum + resolveOrderKopecks(order), 0);

      return { label, orderAmount, payoutAmount, frozenAmount };
    });

    const maxValue = rows.reduce(
      (max, row) =>
        Math.max(max, row.orderAmount, row.payoutAmount, row.frozenAmount),
      0
    );
    return { rows, maxValue: maxValue || 1 };
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

  const financeOperations = useMemo(() => {
    const payoutOperations = payments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.createdAt,
      type: 'Выплата',
      orderId: payment.orderId,
      amount: resolvePaymentKopecks(payment),
      status: paymentStatusLabel(payment.status),
      currency: payment.currency
    }));

    const holdOperations = orders
      .filter((order) => Boolean(order.payoutStatus))
      .map((order) => ({
        id: `order-${order.id}`,
        date: order.createdAt,
        type:
          String(order.payoutStatus ?? '').toUpperCase() === 'HOLD'
            ? 'Заморозка'
            : String(order.payoutStatus ?? '').toUpperCase() === 'BLOCKED'
              ? 'Блокировка'
              : ['RELEASED', 'PAID_OUT', 'PAID'].includes(
                    String(order.payoutStatus ?? '').toUpperCase()
                  )
                ? 'Выплата'
                : ['REFUND_PENDING', 'REFUNDED'].includes(
                      String(order.paymentStatus ?? '').toUpperCase()
                    )
                  ? 'Возврат'
                  : 'В обработке',
        orderId: order.id,
        amount: resolveOrderKopecks(order),
        status: payoutStatusLabelRu(order.payoutStatus),
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

  const handleShellTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleShellTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isMostlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    if (!isMostlyHorizontal) return;

    const isMobileViewport =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 960px)').matches;
    if (!isMobileViewport) return;

    if (!isMenuOpen && start.x <= 20 && deltaX > 70) {
      toggleSellerMenu();
      return;
    }

    if (isMenuOpen && deltaX < -70) {
      closeSellerMenu();
    }
  };

  return (
    <section
      className={styles.page}
      onTouchStart={handleShellTouchStart}
      onTouchEnd={handleShellTouchEnd}
    >
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
            subtitle={
              activeItem === 'Сводка'
                ? 'Ключевые показатели, заказы и статус подключения продавца.'
                : 'Управляйте данными продавца и следите за операциями без лишних переходов.'
            }
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
                      value={formatPrice(summary.revenue)}
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
                      <p>
                        Заполните данные продавца, выберите точку отгрузки и
                        прикрепите документы одним отправлением.
                      </p>
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
                          {kycSubmission.comment ??
                            kycSubmission.moderationNotes ??
                            kycSubmission.notes}
                        </p>
                      )}

                      <div className={styles.sectionHeader}>
                        <h3>Данные продавца</h3>
                        <p>
                          Укажите только обязательные данные для подключения
                          продавца.
                        </p>
                      </div>
                      <fieldset
                        disabled={isKycPending || isKycSubmitting}
                        style={{
                          border: 0,
                          padding: 0,
                          margin: 0,
                          display: 'grid',
                          gap: '12px'
                        }}
                      >
                        <div className={styles.settingsGrid}>
                          <label className={styles.labelBlock}>
                            Контактное лицо (ФИО)
                            <input
                              value={merchantForm.contactName}
                              disabled
                              readOnly
                              placeholder="Иванов Иван Иванович"
                            />
                          </label>
                          <label className={styles.labelBlock}>
                            Телефон
                            <input
                              value={merchantForm.contactPhone}
                              disabled
                              readOnly
                              placeholder="+7 (999) 123-45-67"
                            />
                          </label>
                          {(sellerType === 'ООО' ||
                            sellerType === 'Самозанятый') && (
                            <label className={styles.labelBlock}>
                              Официальное название
                              <input
                                value={merchantForm.legalName}
                                onChange={(e) =>
                                  setMerchantForm((p) => ({
                                    ...p,
                                    legalName: e.target.value
                                  }))
                                }
                                placeholder={
                                  sellerType === 'Самозанятый'
                                    ? 'Самозанятый Иванов И. И.'
                                    : 'ООО «Название»'
                                }
                              />
                            </label>
                          )}
                          <label className={styles.labelBlock}>
                            ИНН
                            <input
                              value={merchantForm.inn}
                              onChange={(e) =>
                                setMerchantForm((p) => ({
                                  ...p,
                                  inn: e.target.value
                                    .replace(/\D/g, '')
                                    .slice(0, sellerType === 'ООО' ? 10 : 12)
                                }))
                              }
                              placeholder={
                                sellerType === 'ООО' ? '10 цифр' : '12 цифр'
                              }
                            />
                          </label>
                          {(sellerType === 'ООО' || sellerType === 'ИП') && (
                            <label className={styles.labelBlock}>
                              ОГРН{sellerType === 'ИП' ? 'ИП' : ''}
                              <input
                                value={merchantForm.ogrn}
                                onChange={(e) =>
                                  setMerchantForm((p) => ({
                                    ...p,
                                    ogrn: e.target.value
                                      .replace(/\D/g, '')
                                      .slice(0, sellerType === 'ИП' ? 15 : 13)
                                  }))
                                }
                                placeholder={
                                  sellerType === 'ИП' ? '15 цифр' : '13 цифр'
                                }
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
                            <p>
                              {hasDropoffPvz
                                ? dropoffPvzAddress || `Пункт ${dropoffPvzId}`
                                : 'Пока не выбрана'}
                            </p>
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
                              checked={acceptedRules}
                              onChange={(e) =>
                                setAcceptedRules(e.target.checked)
                              }
                            />
                            <span>
                              Принимаю{' '}
                              <Link to="/offer" className={styles.inlineLink}>
                                оферту
                              </Link>
                              ,{' '}
                              <Link
                                to="/service-rules"
                                className={styles.inlineLink}
                              >
                                правила сервиса
                              </Link>{' '}
                              и{' '}
                              <Link
                                to="/privacy-policy"
                                className={styles.inlineLink}
                              >
                                условия обработки персональных данных
                              </Link>
                            </span>
                          </label>
                        </div>

                        <div className={styles.kycActions}>
                          <Button
                            type="button"
                            onClick={handleKycSubmit}
                            disabled={
                              Boolean(kycSubmitDisabledReason) ||
                              isKycSubmitting
                            }
                          >
                            {isKycSubmitting
                              ? 'Отправка...'
                              : 'Отправить на проверку'}
                          </Button>

                          {isKycPending && (
                            <p className={styles.kycMessage}>На проверке</p>
                          )}
                        </div>

                        {kycSubmitDisabledReason && (
                          <p className={styles.muted}>
                            {kycSubmitDisabledReason}
                          </p>
                        )}
                      </fieldset>
                      {kycError && <p className={styles.error}>{kycError}</p>}
                      {kycMessage && (
                        <p className={styles.kycMessage}>{kycMessage}</p>
                      )}
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
                    <div className={styles.productPanel}>
                      {productActionMessage && (
                        <p className={styles.toast}>{productActionMessage}</p>
                      )}
                      <div className={styles.tableHeader}>
                        <span>Название</span>
                        <span>Цена</span>
                        <span>Категория</span>
                        <span>Статус</span>
                        <span>Действия</span>
                      </div>

                      {products.length === 0 ? (
                        <EmptyState
                          title={
                            canSell
                              ? 'Пока нет товаров'
                              : 'Каталог станет доступен после проверки профиля'
                          }
                          description={
                            canSell
                              ? 'Добавьте первый товар, чтобы он появился в витрине магазина.'
                              : 'После подтверждения продавца вы сможете добавлять и редактировать товары без дополнительных действий.'
                          }
                        />
                      ) : (
                        products.map((product) => (
                          <div key={product.id} className={styles.tableRow}>
                            <span>
                              {product.moderationStatus === 'APPROVED' ? (
                                <button
                                  type="button"
                                  className={styles.linkButton}
                                  onClick={() =>
                                    navigate(`/seller/products/${product.id}`, {
                                      state: {
                                        from: {
                                          pathname: location.pathname,
                                          search: location.search,
                                          hash: location.hash
                                        },
                                        fallback: '/seller'
                                      }
                                    })
                                  }
                                >
                                  {product.title}
                                </button>
                              ) : (
                                product.title
                              )}
                            </span>
                            <span>{formatPrice(product.price)}</span>
                            <span>{product.category}</span>
                            <span>
                              <strong
                                className={`${styles.statusBadge} ${styles[`statusBadge_${getModerationStatusTone(product.moderationStatus)}`]}`}
                              >
                                {getModerationStatusLabelRu(
                                  product.moderationStatus,
                                  product.moderationStatusLabelRu
                                )}
                              </strong>
                              {product.moderationStatus === 'NEEDS_EDIT' &&
                                product.moderationNotes && (
                                  <span className={styles.moderationNote}>
                                    {product.moderationNotes}
                                  </span>
                                )}
                            </span>
                            <div className={styles.rowActions}>
                              <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() => {
                                  if (product.moderationStatus === 'APPROVED') {
                                    navigate(`/seller/products/${product.id}`, {
                                      state: {
                                        from: {
                                          pathname: location.pathname,
                                          search: location.search,
                                          hash: location.hash
                                        },
                                        fallback: '/seller'
                                      }
                                    });
                                    return;
                                  }
                                  setActiveProduct(product);
                                  setIsModalOpen(true);
                                }}
                              >
                                {product.moderationStatus === 'APPROVED'
                                  ? 'Подробнее'
                                  : 'Редактировать'}
                              </button>
                              <span className={styles.actionDivider}>|</span>
                              <button
                                type="button"
                                className={`${styles.linkButton} ${styles.deleteButton}`}
                                onClick={() => handleDeleteProduct(product)}
                              >
                                Удалить
                              </button>
                            </div>
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
                        const displayStatus =
                          getSellerOrderDisplayStatus(order);
                        const total = order.items.reduce((sum, item) => sum + resolveOrderItemLineTotalKopecks(item), 0);
                        const sellerNetAmount = typeof order.sellerNetAmount === 'number' ? order.sellerNetAmount : total;

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
                                  {formatPrice(total)}
                                </p>
                                <div className={styles.orderPayoutSummary}>
                                  <span className={styles.orderPayoutLabel}>
                                    Получит продавец
                                  </span>
                                  <strong>{formatPrice(sellerNetAmount)}</strong>
                                </div>
                                <p className={styles.muted}>
                                  Статус: {displayStatus}
                                </p>
                                {order.paymentStatus === 'PENDING' &&
                                  !order.isExpired &&
                                  typeof order.secondsUntilExpiry ===
                                    'number' && (
                                    <p className={styles.pendingPaymentTimer}>
                                      Ожидает оплату:{' '}
                                      {formatCountdown(
                                        order.secondsUntilExpiry
                                      )}
                                    </p>
                                  )}
                              </div>
                            </div>

                            <div className={styles.deliveryInputs}>
                              <p className={styles.muted}>
                                Способ доставки: ПВЗ (Pickup Point)
                              </p>
                              <p className={styles.muted}>
                                Пункт выдачи:{' '}
                                {order.buyerPickupPvzMeta?.addressFull ?? '—'}
                              </p>
                              <p className={styles.muted}>
                                Пункт сдачи:{' '}
                                {order.sellerDropoffPvzId ||
                                  dropoffPvzId ||
                                  '—'}
                              </p>
                              <div className={styles.orderFinanceMeta}>
                                <p className={styles.muted}>
                                  Выплата: {payoutStatusLabelRu(order.payoutStatus)}
                                </p>
                                <p className={styles.muted}>
                                  Сумма продавца: {formatPrice(sellerNetAmount)}
                                </p>
                                {order.yookassaDealId ? (
                                  <p className={styles.muted}>
                                    Safe Deal: {String(order.yookassaDealStatus ?? 'PENDING')}
                                  </p>
                                ) : null}
                              </div>
                              <p className={styles.muted}>
                                Статус доставки: {displayStatus}
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
                                disabled={
                                  !order.paidAt && order.status !== 'PAID'
                                }
                              >
                                {order.isPacked
                                  ? 'Снять отметку упаковки'
                                  : 'Отметить упаковку'}
                              </Button>

                              {!order.shipment?.id ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => handleReadyToShip(order.id)}
                                    disabled={Boolean(
                                      readyToShipDisabledReason(order)
                                    )}
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
                                  disabled={
                                    !order.shipment?.id && !order.cdekOrderId
                                  }
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
                                  Сумма: {formatPrice(total)}
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
                                className={
                                  labelDownloaded[order.id]
                                    ? styles.downloadedButton
                                    : ''
                                }
                                onClick={() =>
                                  order.shipment?.id &&
                                  handleDownloadLabel(
                                    order.shipment.id,
                                    order.id
                                  )
                                }
                                disabled={
                                  !order.shipment?.id || !order.trackingNumber
                                }
                              >
                                Скачать ярлык
                              </Button>

                              {!order.trackingNumber && (
                                <p className={styles.muted}>ещё формируется</p>
                              )}

                              <Button
                                type="button"
                                variant="ghost"
                                className={
                                  actDownloaded[order.id]
                                    ? styles.downloadedButton
                                    : ''
                                }
                                onClick={() =>
                                  order.shipment?.id &&
                                  handleDownloadAct(order.shipment.id, order.id)
                                }
                                disabled={
                                  !order.shipment?.id && !order.cdekOrderId
                                }
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
                      <h2>Финансы продавца</h2>
                      <p>
                        Блок подготовлен под денежный контур маркетплейса и
                        интеграцию с YooKassa без изменения текущей логики
                        выплат.
                      </p>
                    </div>
                  </div>

                  <div className={styles.financeSummaryGrid}>
                    <SellerStatsCard
                      title="Доступно"
                      value={formatPrice(financeSummary.available)}
                    />
                    <SellerStatsCard
                      title="Заморожено"
                      value={formatPrice(financeSummary.frozen)}
                    />
                    <SellerStatsCard
                      title="Выплачено"
                      value={formatPrice(financeSummary.released)}
                    />
                    <SellerStatsCard
                      title="В обработке"
                      value={formatPrice(financeSummary.inProcessing)}
                    />
                  </div>

                  <div className={styles.financeGrid}>
                    <div className={styles.financeChartCard}>
                      <div className={styles.sectionHeader}>
                        <div>
                          <h3>Движение по периодам</h3>
                          <p>
                            Поступления, выплаты и удержания по последним
                            месяцам.
                          </p>
                        </div>
                      </div>
                      <div className={styles.financeChartLegend}>
                        <span>
                          <i className={styles.financeLegendRevenue} />
                          Поступления
                        </span>
                        <span>
                          <i className={styles.financeLegendPayout} />
                          Выплаты
                        </span>
                        <span>
                          <i className={styles.financeLegendFrozen} />
                          Заморозка
                        </span>
                      </div>
                      <div className={styles.financeChart}>
                        {financeChartRows.rows.map((row) => (
                          <div
                            key={row.label}
                            className={styles.financeChartRow}
                          >
                            <span className={styles.financeChartLabel}>
                              {row.label}
                            </span>
                            <div className={styles.financeBars}>
                              <div className={styles.financeBarTrack}>
                                <div
                                  className={`${styles.financeBar} ${styles.financeBarRevenue}`}
                                  style={{
                                    width: `${(row.orderAmount / financeChartRows.maxValue) * 100}%`
                                  }}
                                />
                              </div>
                              <div className={styles.financeBarTrack}>
                                <div
                                  className={`${styles.financeBar} ${styles.financeBarPayout}`}
                                  style={{
                                    width: `${(row.payoutAmount / financeChartRows.maxValue) * 100}%`
                                  }}
                                />
                              </div>
                              <div className={styles.financeBarTrack}>
                                <div
                                  className={`${styles.financeBar} ${styles.financeBarFrozen}`}
                                  style={{
                                    width: `${(row.frozenAmount / financeChartRows.maxValue) * 100}%`
                                  }}
                                />
                              </div>
                            </div>
                            <span className={styles.financeChartValue}>
                              {formatPrice(row.orderAmount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.financeInfoCard}>
                      <h3>Статусы операций</h3>
                      <ul className={styles.financeStatusList}>
                        <li>
                          <strong>Доступно</strong>
                          <span>Средства, готовые к выводу/зачислению.</span>
                        </li>
                        <li>
                          <strong>Заморожено</strong>
                          <span>
                            Заказы в hold до завершения сценария доставки.
                          </span>
                        </li>
                        <li>
                          <strong>Выплачено</strong>
                          <span>
                            Операции с подтвержденной выплатой продавцу.
                          </span>
                        </li>
                        <li>
                          <strong>В обработке</strong>
                          <span>
                            Подготовленные backend-ом операции, ожидающие
                            завершения.
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {paymentsLoading ? (
                    <p className={styles.muted}>
                      Загрузка финансовых операций...
                    </p>
                  ) : paymentsError ? (
                    <p className={styles.error}>{paymentsError}</p>
                  ) : financeOperations.length === 0 ? (
                    <div className={styles.infoCard}>
                      <h3>История операций пока пуста</h3>
                      <p className={styles.muted}>
                        Как только появятся выплаты, холды или разблокировки,
                        они будут показаны в этом разделе.
                      </p>
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
                        <div
                          key={operation.id}
                          className={styles.financeTableRow}
                        >
                          <span>{formatDate(operation.date)}</span>
                          <span>{operation.type}</span>
                          <span className={styles.cellTruncate}>
                            №{operation.orderId}
                          </span>
                          <span>
                            {formatPrice(operation.amount, operation.currency)}
                          </span>
                          <span>{operation.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeItem === 'Поддержка' && (
                <div className={styles.section}>
                  <div className={styles.supportCard}>
                    <div className={styles.supportHero}>
                      <h2>Поддержка продавцов</h2>
                      <p className={styles.muted}>
                        Если нужна помощь по отгрузке, модерации или выплатам,
                        откройте чат с поддержкой.
                      </p>
                    </div>
                    <div className={styles.supportActions}>
                      <Button
                        type="button"
                        onClick={() => {
                          window.location.assign('/account?tab=chats');
                        }}
                      >
                        Открыть чат с поддержкой
                      </Button>
                      <p className={styles.helperText}>
                        Чат откроется в разделе сообщений аккаунта без изменений
                        backend-логики.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeItem === 'Настройки' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p>Актуальные данные магазина.</p>
                    </div>
                  </div>

                  {sellerProfile ? (
                    <div className={styles.settingsGrid}>
                      <label className={styles.labelBlock}>
                        <span className={styles.muted}>Название магазина</span>
                        <input
                          value={sellerProfile.storeName ?? ''}
                          placeholder="По умолчанию - ваше ФИО"
                          readOnly
                        />
                        <span className={styles.helperText}>
                          На витрине сейчас будет показано: {displayStoreName}
                        </span>
                      </label>
                      <div>
                        <span className={styles.muted}>Тип продавца</span>
                        <p>{sellerType ?? '—'}</p>
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

                  <p className={styles.muted}>
                    Редактирование профиля доступно через форму подключения
                    продавца.
                  </p>

                  <div className={styles.settingsGrid}>
                    <div>
                      <span className={styles.muted}>Точка отгрузки</span>
                      <p>
                        {dropoffPvzAddress ||
                          (dropoffPvzId
                            ? `Пункт ${dropoffPvzId}`
                            : 'Пока не выбрана')}
                      </p>

                      <div className={styles.inlineActions}>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setDropoffModalOpen(true)}
                        >
                          Выбрать точку
                        </Button>
                      </div>

                      {deliverySettingsError && (
                        <p
                          className={styles.error}
                          style={{ marginTop: '0.5rem' }}
                        >
                          {deliverySettingsError}
                        </p>
                      )}
                    </div>
                  </div>

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
      <BottomNav forceShow onNavigate={closeSellerMenu} />
    </section>
  );
};
