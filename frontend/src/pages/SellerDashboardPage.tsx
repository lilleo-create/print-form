import {
  TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { api } from '../shared/api';
import { ordersApi } from '../shared/api/ordersApi';
import { sellerFinanceApi } from '../shared/api/sellerFinanceApi';
import { normalizeApiError } from '../shared/api/client';
import { useSellerContext } from '../hooks/seller/useSellerContext';
import { useHeaderMenuStore } from '../app/store/headerMenuStore';
import {
  Order,
  OrderStatus,
  Product,
  SellerFinanceDashboardResponse,
  SellerPayoutCreateResponse,
  SellerKycSubmission,
  SellerPayoutMethod,
  SellerPayoutMethodBindPayload
} from '../shared/types';
import { Button } from '../shared/ui/Button';
import { Badge } from '../shared/ui/Badge';
import { EmptyState } from '../shared/ui/EmptyState';
import { SellerActions } from '../components/seller/SellerActions';
import { SellerErrorState } from '../components/seller/SellerErrorState';
import { SellerHeader } from '../components/seller/SellerHeader';
import { SellerStatsCard } from '../components/seller/SellerStatsCard';
import { CopyableOrderNumber } from '../components/seller/CopyableOrderNumber';
import { SellerFinanceTable } from '../components/seller/SellerFinanceTable';
import { SellerFinanceMobileCard } from '../components/seller/SellerFinanceMobileCard';
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
import { getShortOrderId } from '../shared/utils/orderId';
import {
  initYooKassaPayoutWidget,
  YooKassaWidgetSuccessPayload
} from '../shared/lib/yookassaPayoutWidget';
import { resolvePriceMinorUnits } from '../shared/lib/productPrice';
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

const formatMoneyRub = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

const formatMoney = (params: {
  displayRubles?: string | number | null;
  kopecks?: number | null;
}) => {
  const { displayRubles, kopecks } = params;
  if (typeof displayRubles === 'string' && displayRubles.trim().length > 0) {
    const parsed = Number(displayRubles);
    if (Number.isFinite(parsed)) return formatMoneyRub(parsed);
  }
  if (typeof displayRubles === 'number' && Number.isFinite(displayRubles)) {
    return formatMoneyRub(displayRubles);
  }
  return formatPrice(typeof kopecks === 'number' ? kopecks : 0);
};

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

const YOOKASSA_WIDGET_NOT_ENABLED_MESSAGE =
  'Привязка карты временно недоступна: интеграция выплат сейчас отключена.';
const YOOKASSA_WIDGET_INVALID_CONFIG_MESSAGE =
  'Не удалось загрузить форму привязки карты: некорректная конфигурация выплат.';
const YOOKASSA_WIDGET_LOADING_CONFIG_MESSAGE = 'Загружаем настройки выплат...';
const YOOKASSA_WIDGET_LOADING_SCRIPT_MESSAGE =
  'Загружаем библиотеку YooKassa...';
const YOOKASSA_WIDGET_LOADING_MESSAGE =
  'Загружаем защищённую форму привязки карты...';
const YOOKASSA_WIDGET_ERROR_MESSAGE =
  'Не удалось загрузить форму привязки карты. Обновите страницу или попробуйте позже.';

const firstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return '';
};

type PayoutWidgetResolvedConfig = {
  enabled: boolean;
  type: string;
  accountId: string;
  hasSavedCard: boolean;
  card: Record<string, unknown> | null;
};

const toBoolean = (value: unknown) => value === true;

const resolvePayoutWidgetConfig = (
  widgetConfig: Record<string, unknown> | null | undefined
): PayoutWidgetResolvedConfig => {
  const enabled = toBoolean(widgetConfig?.enabled);
  const type =
    typeof widgetConfig?.type === 'string'
      ? widgetConfig.type.trim().toLowerCase()
      : '';
  const accountId =
    typeof widgetConfig?.account_id === 'string'
      ? widgetConfig.account_id
      : typeof widgetConfig?.accountId === 'string'
        ? widgetConfig.accountId
        : '';
  const hasSavedCard =
    toBoolean(widgetConfig?.hasSavedCard) ||
    toBoolean(widgetConfig?.has_saved_card);
  const card =
    widgetConfig?.card && typeof widgetConfig.card === 'object'
      ? (widgetConfig.card as Record<string, unknown>)
      : null;
  return { enabled, type, accountId: accountId.trim(), hasSavedCard, card };
};

const formatSavedPayoutCardLabel = (card?: {
  cardType?: string | null;
  first6?: string | null;
  last4?: string | null;
}) => {
  if (card?.cardType && card?.last4)
    return `${card.cardType} •••• ${card.last4}`;
  if (card?.last4) return `Карта •••• ${card.last4}`;
  if (card?.cardType) return `Карта ${card.cardType}`;
  return 'Карта привязана';
};

const formatCardMask = (params: {
  maskedLabel?: string | null;
  first6?: string | null;
  last4?: string | null;
}) => {
  const maskedLabel = params.maskedLabel?.trim();
  if (maskedLabel) return maskedLabel;
  const first6 = params.first6?.trim();
  const last4 = params.last4?.trim();
  if (first6 && last4) return `${first6} ****** ${last4}`;
  if (last4) return `•••• ${last4}`;
  return 'Банковская карта';
};

const parseRubAmountToKopecks = (value: string): number | null => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  if (!/^\d+([.]\d{0,2})?$/.test(normalized)) return null;
  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue)) return null;
  return Math.round(numberValue * 100);
};

const kopecksToAmount = (value: number) => (value / 100).toFixed(2);

const normalizePayoutAmountInput = (value: string) => {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [integerPart = '', ...fractionalParts] = normalized.split('.');
  const sanitizedInteger = integerPart.replace(/^0+(?=\d)/, '');
  const fractionalPart = fractionalParts.join('').slice(0, 2);
  if (fractionalParts.length === 0) {
    return sanitizedInteger;
  }
  return `${sanitizedInteger || '0'}.${fractionalPart}`;
};

const resolvePayoutSubmitErrorMessage = (error: unknown) => {
  const normalized = normalizeApiError(error);
  const code = (normalized.code ?? '').toUpperCase();
  const message = normalized.message ?? '';
  const details = [code, message].join(' ').toLowerCase();

  if (
    details.includes('card') &&
    (details.includes('missing') || details.includes('not found'))
  ) {
    return 'Нет привязанной карты для выплат.';
  }
  if (details.includes('min') || details.includes('minimum')) {
    return 'Сумма меньше минимально допустимой для выплаты.';
  }
  if (
    details.includes('insufficient') ||
    details.includes('available') ||
    details.includes('balance')
  ) {
    return 'Сумма больше доступного остатка для выплаты.';
  }
  if (details.includes('deal') && details.includes('id')) {
    return 'Не удалось создать выплату: отсутствует deal id.';
  }
  if (details.includes('provider') || details.includes('yookassa')) {
    return 'Ошибка провайдера выплат. Повторите попытку позже.';
  }
  if (message) return message;
  return 'Не удалось создать выплату. Неизвестная ошибка.';
};

const toKopecks = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.round(value * 100);
};

const ensureArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? value : [];

type NormalizedPayoutMethods = {
  methods: SellerPayoutMethod[];
  widgetConfig: Record<string, unknown> | null;
};

const normalizePayoutMethodsResponse = (
  payload: unknown
): NormalizedPayoutMethods => {
  const list = pickApiList<SellerPayoutMethod>(payload);
  if (Array.isArray(payload)) {
    return { methods: list, widgetConfig: null };
  }

  if (!payload || typeof payload !== 'object') {
    return { methods: list, widgetConfig: null };
  }

  const source = payload as Record<string, unknown>;
  const widgetConfigCandidate =
    (source.widgetConfig as Record<string, unknown> | null | undefined) ??
    (source.payoutWidgetConfig as Record<string, unknown> | null | undefined) ??
    (source.config as Record<string, unknown> | null | undefined) ??
    null;

  return {
    methods: list,
    widgetConfig:
      widgetConfigCandidate && typeof widgetConfigCandidate === 'object'
        ? widgetConfigCandidate
        : null
  };
};

const normalizeFinanceDashboard = (
  value: SellerFinanceDashboardResponse
): SellerFinanceDashboardResponse => {
  const summary =
    (value as { summary?: Record<string, number | undefined> })?.summary ?? {};
  const nextPayout =
    (
      value as {
        nextPayout?: Record<string, string | number | null | undefined>;
      }
    )?.nextPayout ?? {};

  return {
    summary: {
      awaitingPayoutKopecks:
        summary.awaitingPayoutKopecks ?? summary.pendingPayoutMinor ?? 0,
      frozenKopecks: summary.frozenKopecks ?? summary.frozenMinor ?? 0,
      paidOutKopecks: summary.paidOutKopecks ?? summary.paidOutMinor ?? 0,
      adjustmentsKopecks:
        summary.adjustmentsKopecks ?? summary.refundsAndHoldsMinor ?? 0
    },
    nextPayout: {
      scheduledAt:
        (nextPayout.scheduledAt as string | null | undefined) ??
        (nextPayout.availableAt as string | null | undefined) ??
        null,
      amountKopecks:
        (nextPayout.amountKopecks as number | undefined) ??
        (nextPayout.amountMinor as number | undefined) ??
        0,
      orderCount:
        (nextPayout.orderCount as number | undefined) ??
        (nextPayout.ordersCount as number | undefined) ??
        0,
      payoutScheduleType:
        (nextPayout.payoutScheduleType as string | null | undefined) ?? null
    },
    payoutQueue: ensureArray(
      value?.payoutQueue ?? (value as { queue?: unknown }).queue
    ),
    adjustments: ensureArray(
      value?.adjustments ?? (value as { holds?: unknown }).holds
    ),
    payoutHistory: ensureArray(
      value?.payoutHistory ?? (value as { history?: unknown }).history
    ),
    payoutWidgetConfig: value?.payoutWidgetConfig ?? null
  };
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

const payoutStatusLabelRu = (value?: string | null) => {
  switch (String(value ?? '').toUpperCase()) {
    case 'HOLD':
      return 'Заморожено';
    case 'AWAITING_PAYOUT':
      return 'Ожидает выплаты';
    case 'PAYOUT_PENDING':
      return 'Выплата создаётся';
    case 'REFUNDED':
      return 'Возвращено покупателю';
    case 'FAILED':
    case 'PAYOUT_CANCELED':
      return 'Выплата не прошла';
    case 'PAID_OUT':
    case 'RELEASED':
      return 'Выплачено';
    case 'BLOCKED':
      return 'Заблокировано';
    default:
      return 'В обработке';
  }
};

const payoutScheduleLabelRu = (value?: string | null) => {
  switch (String(value ?? '').toUpperCase()) {
    case 'MANUAL':
      return 'Вручную / по регламенту платформы';
    case 'DAILY':
      return 'Ежедневно';
    case 'WEEKLY':
      return 'Еженедельно';
    default:
      return 'По регламенту платформы';
  }
};

const adjustmentTypeLabelRu = (value?: string | null) => {
  switch (String(value ?? '').toUpperCase()) {
    case 'REFUND':
      return 'Возврат';
    case 'BLOCKED':
      return 'Блокировка';
    case 'PAYOUT_CANCELED':
      return 'Неуспешная выплата';
    default:
      return 'Корректировка';
  }
};

const payoutCancelReasonLabelRu = (value?: string | null) => {
  switch (String(value ?? '').toLowerCase()) {
    case 'fraud_suspected':
      return 'Подозрение на мошенничество';
    case 'general_decline':
      return 'Отклонено платёжной системой';
    case 'identification_required':
      return 'Требуется идентификация получателя';
    case 'one_time_limit_exceeded':
      return 'Превышен разовый лимит';
    case 'periodic_limit_exceeded':
      return 'Превышен периодический лимит';
    case 'rejected_by_payee':
      return 'Получатель отклонил выплату';
    default:
      return null;
  }
};

const kycStatusLabelRu = (value?: string | null) => {
  switch (String(value ?? '').toUpperCase()) {
    case 'APPROVED':
      return 'Одобрено';
    case 'PENDING':
      return 'На проверке';
    case 'REJECTED':
      return 'Отклонено';
    case 'NEEDS_INFO':
      return 'Нужны уточнения';
    default:
      return 'Не отправлено';
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

const pickApiList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload;
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  return [];
};

export const SellerDashboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeItem, setActiveItem] =
    useState<(typeof menuItems)[number]>('Сводка');
  const isMenuOpen = useHeaderMenuStore((state) => state.isSellerMenuOpen);
  const closeSellerMenu = useHeaderMenuStore((state) => state.closeSellerMenu);
  const toggleSellerMenu = useHeaderMenuStore(
    (state) => state.toggleSellerMenu
  );
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
  const [ordersSearchInput, setOrdersSearchInput] = useState('');
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');
  const [ordersTab, setOrdersTab] = useState<
    'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  >('ACTIVE');
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

  const [financeDashboard, setFinanceDashboard] =
    useState<SellerFinanceDashboardResponse | null>(null);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [payoutMethods, setPayoutMethods] = useState<SellerPayoutMethod[]>([]);
  const [payoutMethodsLoading, setPayoutMethodsLoading] = useState(true);
  const [payoutMethodError, setPayoutMethodError] = useState<string | null>(
    null
  );
  const [payoutMethodsUnauthorized, setPayoutMethodsUnauthorized] =
    useState(false);
  const [payoutWidgetConfig, setPayoutWidgetConfig] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [payoutMethodSuccess, setPayoutMethodSuccess] = useState<string | null>(
    null
  );
  const [isPayoutBindExpanded, setPayoutBindExpanded] = useState(false);
  const [payoutWidgetInfo, setPayoutWidgetInfo] = useState<string | null>(null);
  const [payoutWidgetError, setPayoutWidgetError] = useState<string | null>(
    null
  );
  const [isPayoutWidgetLoading, setPayoutWidgetLoading] = useState(false);
  const [payoutWidgetStage, setPayoutWidgetStage] =
    useState<PayoutWidgetStage>('idle');
  const payoutWidgetRenderKeyRef = useRef<string | null>(null);
  const payoutWidgetInstanceRef = useRef<{
    clearListeners?: () => void;
  } | null>(null);
  const [payoutAmountInput, setPayoutAmountInput] = useState('');
  const [payoutDescription, setPayoutDescription] = useState(
    'Выплата продавцу Print-Form'
  );
  const [payoutSubmitError, setPayoutSubmitError] = useState<string | null>(
    null
  );
  const [isPayoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutCreated, setPayoutCreated] =
    useState<SellerPayoutCreateResponse | null>(null);
  const [payoutResultTitle, setPayoutResultTitle] = useState<string | null>(
    null
  );
  const [payoutRawError, setPayoutRawError] = useState<string | null>(null);
  const [lastPayoutRawResponse, setLastPayoutRawResponse] =
    useState<unknown>(null);

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
  const isDevPayoutToolsEnabled =
    import.meta.env.DEV ||
    import.meta.env.MODE === 'test' ||
    import.meta.env.VITE_ENABLE_PAYOUT_DEV_TOOLS === 'true' ||
    import.meta.env.VITE_ENABLE_DEV_PAYOUT_TOOLS === 'true';
  const shouldShowDevPayoutTools = true;
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

  const isKycApproved = kycSubmission?.status === 'APPROVED';
  const moderationComment =
    kycSubmission?.comment ??
    kycSubmission?.moderationNotes ??
    kycSubmission?.notes ??
    '';
  const sellerIdentityRows = [
    { label: 'Контактное лицо', value: merchantForm.contactName || '—' },
    { label: 'Телефон', value: merchantForm.contactPhone || '—' },
    ...(sellerType === 'ООО' || sellerType === 'Самозанятый'
      ? [
          {
            label: 'Официальное название',
            value: merchantForm.legalName || '—'
          }
        ]
      : []),
    { label: 'ИНН', value: merchantForm.inn || '—' },
    ...(sellerType === 'ООО' || sellerType === 'ИП'
      ? [
          {
            label: `ОГРН${sellerType === 'ИП' ? 'ИП' : ''}`,
            value: merchantForm.ogrn || '—'
          }
        ]
      : [])
  ];

  const renderPayoutMethodsSettingsBlock = () => (
    <div className={`${styles.settingsPanel} ${styles.payoutSettingsPanel}`}>
      <div className={styles.payoutMethodsHeader}>
        <div>
          <h3>Реквизиты для выплат</h3>
          <p className={styles.muted}>
            Привяжите банковскую карту для выплат по безопасной сделке.
          </p>
        </div>
        {hasSavedCard && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPayoutBindExpanded(true);
              payoutWidgetRenderKeyRef.current = null;
              setPayoutWidgetInfo(null);
              setPayoutWidgetError(null);
              setPayoutWidgetLoading(false);
              setPayoutWidgetStage('idle');
              setPayoutMethodError(null);
              setPayoutMethodSuccess(null);
            }}
          >
            Изменить карту
          </Button>
        )}
      </div>
      {payoutMethodsLoading && (
        <p className={styles.muted}>Загружаем реквизиты для выплат...</p>
      )}
      {!payoutMethodsLoading && hasSavedCard && !isPayoutBindExpanded && (
        <article className={styles.payoutMethodCard}>
          <div className={styles.payoutMethodTop}>
            <strong>{savedCardMeta.cardLabel}</strong>
            <Badge variant="success">Активна для выплат</Badge>
          </div>
          <p className={styles.payoutCardMask}>{savedCardMeta.maskedLabel}</p>
          {!savedCardMeta.hasCardMaskData && (
            <p className={styles.muted}>
              Данные маски карты пока не получены от сервера.
            </p>
          )}
          {savedCardMeta.issuerName && (
            <p className={styles.muted}>Банк: {savedCardMeta.issuerName}</p>
          )}
          <p className={styles.muted}>
            Обновлено:{' '}
            {savedCardMeta.updatedAt
              ? formatDate(savedCardMeta.updatedAt)
              : formatDate(new Date().toISOString())}
          </p>
        </article>
      )}
      {payoutMethodError && <p className={styles.error}>{payoutMethodError}</p>}
      {payoutMethodSuccess && (
        <p className={styles.successMessage}>{payoutMethodSuccess}</p>
      )}

      {!payoutMethodError && (!hasSavedCard || isPayoutBindExpanded) && (
        <div className={styles.payoutBindInlineBlock}>
          {payoutMethodsLoading && (
            <p className={styles.muted}>
              {YOOKASSA_WIDGET_LOADING_CONFIG_MESSAGE}
            </p>
          )}
          {isPayoutWidgetLoading && payoutWidgetStage === 'script' && (
            <p className={styles.muted}>
              {YOOKASSA_WIDGET_LOADING_SCRIPT_MESSAGE}
            </p>
          )}
          {isPayoutWidgetLoading && payoutWidgetStage === 'widget' && (
            <p className={styles.muted}>{YOOKASSA_WIDGET_LOADING_MESSAGE}</p>
          )}
          <div
            id="yookassa-payouts-widget-container"
            className={styles.payoutWidgetContainer}
          />
          {payoutWidgetInfo && (
            <p className={styles.infoText}>{payoutWidgetInfo}</p>
          )}
          {payoutWidgetError && (
            <p className={styles.error}>{payoutWidgetError}</p>
          )}
          {isPayoutBindExpanded && (
            <div className={styles.payoutBindActions}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPayoutBindExpanded(false);
                  payoutWidgetRenderKeyRef.current = null;
                  setPayoutWidgetInfo(null);
                  setPayoutWidgetError(null);
                  setPayoutWidgetLoading(false);
                  setPayoutWidgetStage('idle');
                  setPayoutMethodError(null);
                  clearPayoutWidgetInstance();
                  clearPayoutWidgetContainer();
                }}
              >
                Отмена
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

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
      setProducts(pickApiList<Product>(productsResponse.data));
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
        return;
      }

      const data = await ordersApi.listBySeller(userId, {
        search: ordersSearchQuery
      });
      setOrders(data);

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
      if (isAccessError(error) && isSellerReady) {
        setOrdersError('Сессия истекла, войдите снова.');
      } else if (isSellerReady) {
        setOrdersError('Не удалось загрузить заказы.');
      }
    } finally {
      setOrdersLoading(false);
    }
  }, [isSellerReady, ordersSearchQuery, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOrdersSearchQuery(ordersSearchInput.trim());
    }, 400);
    return () => window.clearTimeout(timer);
  }, [ordersSearchInput]);

  useEffect(() => {
    if (!productActionMessage) return;
    const timer = window.setTimeout(() => setProductActionMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [productActionMessage]);

  useEffect(() => {
    const timer = window.setInterval(() => {
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

  const loadFinanceData = useCallback(async () => {
    setFinanceLoading(true);
    setFinanceError(null);
    try {
      const response = await sellerFinanceApi.getDashboard();
      const financePayload =
        response?.data as SellerFinanceDashboardResponse & {
          queue?: unknown;
          history?: unknown;
          holds?: unknown;
        };
      console.log('[finance] raw response', response);
      console.log('[finance] summary', financePayload?.summary);
      console.log(
        '[finance] queue',
        financePayload?.payoutQueue ?? financePayload?.queue
      );
      console.log(
        '[finance] history',
        financePayload?.payoutHistory ?? financePayload?.history
      );
      console.log(
        '[finance] holds',
        financePayload?.adjustments ?? financePayload?.holds
      );
      setFinanceDashboard(normalizeFinanceDashboard(response.data));
    } catch (error) {
      setFinanceDashboard(null);
      if (isAccessError(error) && isSellerReady) {
        setFinanceError('Сессия истекла, войдите снова.');
      } else if (isSellerReady) {
        setFinanceError('Не удалось загрузить данные бухгалтерии.');
      }
    } finally {
      setFinanceLoading(false);
    }
  }, [isSellerReady]);

  const loadPayoutSettings = useCallback(async () => {
    setPayoutMethodsLoading(true);
    setPayoutMethodError(null);
    setPayoutMethodsUnauthorized(false);
    setPayoutWidgetConfig(null);
    try {
      const response = await sellerFinanceApi.getPayoutMethods();
      const status: number = 200;
      const normalizedPayoutMethods = normalizePayoutMethodsResponse(
        response.data
      );
      console.log('[payout-methods] raw response', response);
      console.log('[payout-methods] status', status);
      console.log('[payout-methods] authorized', status !== 401);
      console.log('[payout-methods] normalized data', normalizedPayoutMethods);
      setPayoutMethods(normalizedPayoutMethods.methods);
      setPayoutWidgetConfig(normalizedPayoutMethods.widgetConfig);
    } catch (error) {
      console.error('[payout-methods] request failed', error);
      setPayoutMethods([]);
      const normalized = normalizeApiError(error);
      const status = normalized.status ?? 0;
      console.log('[payout-methods] status', status);
      console.log('[payout-methods] authorized', status !== 401);
      if (status === 401) {
        setPayoutMethodsUnauthorized(true);
        setPayoutMethodError(
          'Не удалось получить данные по выплатам. Требуется повторная авторизация.'
        );
      } else {
        setPayoutMethodError(
          normalized.message ??
            'Не удалось получить данные по реквизитам выплат.'
        );
      }
    } finally {
      setPayoutMethodsLoading(false);
    }
  }, []);

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
      setFinanceDashboard(null);
      setPayoutMethods([]);
      setPayoutMethodsUnauthorized(false);
      setPayoutWidgetConfig(null);
      setOrders([]);
      setOrdersError(null);
      setFinanceError(null);
      setProductsError(null);

      setKycSubmission(null);
      setKycLoading(false);
      setKycError(null);

      setIsProductsLoading(false);
      setFinanceLoading(false);
      setPayoutMethodsLoading(false);
      setOrdersLoading(false);
      return;
    }

    void loadProducts();
    void loadKyc();
    void loadFinanceData();
    void loadPayoutSettings();
    if (userId) void loadOrders();
  }, [
    isSellerReady,
    loadFinanceData,
    loadKyc,
    loadOrders,
    loadPayoutSettings,
    loadProducts,
    userId
  ]);

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
    if (order.status === 'CANCELLED') return 'Заказ отменён';
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

  const isCancelledOrder = (order: Order) => order.status === 'CANCELLED';
  const isCompletedOrder = (order: Order) =>
    ['DELIVERED', 'RETURNED'].includes(
      String(order.status ?? '').toUpperCase()
    );

  const searchedOrders = useMemo(() => {
    const normalizedSearch = ordersSearchQuery.toLowerCase();
    if (!normalizedSearch) return orders;
    return orders.filter((order) => {
      const displayNumber = (
        order.publicNumber?.trim() || getShortOrderId(order.id)
      ).toLowerCase();
      return displayNumber.includes(normalizedSearch);
    });
  }, [orders, ordersSearchQuery]);

  const ordersView = useMemo(() => {
    const visibleOrders = searchedOrders.filter(
      (order) =>
        !(order.paymentStatus === 'PAYMENT_EXPIRED' || order.isExpired === true)
    );

    return visibleOrders.filter((order) => {
      if (ordersTab === 'CANCELLED') return isCancelledOrder(order);
      if (ordersTab === 'COMPLETED') return isCompletedOrder(order);
      return !isCancelledOrder(order) && !isCompletedOrder(order);
    });
  }, [ordersTab, searchedOrders]);

  const ordersTabCounts = useMemo(() => {
    const visibleOrders = searchedOrders.filter(
      (order) =>
        !(order.paymentStatus === 'PAYMENT_EXPIRED' || order.isExpired === true)
    );
    return {
      ACTIVE: visibleOrders.filter(
        (order) => !isCancelledOrder(order) && !isCompletedOrder(order)
      ).length,
      COMPLETED: visibleOrders.filter((order) => isCompletedOrder(order))
        .length,
      CANCELLED: visibleOrders.filter((order) => isCancelledOrder(order)).length
    };
  }, [searchedOrders]);

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

  const financeData = useMemo(() => {
    if (!financeDashboard) return null;
    const queue = financeDashboard?.payoutQueue ?? [];
    const adjustments = financeDashboard?.adjustments ?? [];
    const history = financeDashboard?.payoutHistory ?? [];

    const matchBySearch = (
      orderId?: string | null,
      publicNumber?: string | null
    ) => {
      const normalizedSearch = ordersSearchQuery.trim().toLowerCase();
      if (!normalizedSearch) return true;
      return [orderId, publicNumber]
        .filter((value): value is string => typeof value === 'string')
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    };

    return {
      ...financeDashboard,
      payoutQueue: queue.filter((item) =>
        matchBySearch(item.orderId, item.publicNumber)
      ),
      adjustments: adjustments.filter((item) =>
        matchBySearch(item.orderId, item.publicNumber)
      ),
      payoutHistory: history.filter((item) =>
        matchBySearch(item.orderId, item.publicNumber)
      )
    };
  }, [financeDashboard, ordersSearchQuery]);

  const resolvedPayoutWidgetConfig = useMemo(
    () => resolvePayoutWidgetConfig(payoutWidgetConfig),
    [payoutWidgetConfig]
  );
  const savedPayoutMethod = payoutMethods[0] ?? null;
  const savedCardMeta = useMemo(() => {
    const fromConfig = resolvedPayoutWidgetConfig.card ?? {};
    const first6 =
      typeof fromConfig.first6 === 'string'
        ? fromConfig.first6
        : typeof fromConfig.first_6 === 'string'
          ? fromConfig.first_6
          : null;
    const last4 =
      typeof fromConfig.last4 === 'string'
        ? fromConfig.last4
        : typeof fromConfig.last_4 === 'string'
          ? fromConfig.last_4
          : (savedPayoutMethod?.cardLast4 ?? null);
    const issuerName =
      typeof fromConfig.issuerName === 'string'
        ? fromConfig.issuerName
        : typeof fromConfig.issuer_name === 'string'
          ? fromConfig.issuer_name
          : null;
    const cardType =
      typeof fromConfig.cardType === 'string'
        ? fromConfig.cardType
        : typeof fromConfig.card_type === 'string'
          ? fromConfig.card_type
          : (savedPayoutMethod?.cardType ?? null);
    const normalizedCardType = cardType || null;
    const cardLabel = formatSavedPayoutCardLabel({
      cardType: normalizedCardType,
      first6,
      last4
    });
    const hasCardMaskData = Boolean(
      (first6 && first6.trim()) || (last4 && last4.trim())
    );

    return {
      cardType: normalizedCardType,
      cardLabel,
      maskedLabel: formatCardMask({
        maskedLabel: savedPayoutMethod?.maskedLabel,
        first6,
        last4
      }),
      hasCardMaskData,
      issuerName: issuerName || null,
      updatedAt:
        savedPayoutMethod?.updatedAt ?? savedPayoutMethod?.createdAt ?? null
    };
  }, [resolvedPayoutWidgetConfig.card, savedPayoutMethod]);

  const availableForPayoutKopecks =
    financeDashboard?.summary.awaitingPayoutKopecks ?? 0;
  const payoutAmountKopecks = parseRubAmountToKopecks(payoutAmountInput);
  const payoutMinKopecks = 100;
  const payoutMaxKopecks = 15000000;
  const hasSavedCard =
    resolvedPayoutWidgetConfig.hasSavedCard ||
    payoutMethods.some((method) => method.status === 'ACTIVE');
  const hasAvailableFunds = availableForPayoutKopecks > 0;
  const canEditPayoutAmount =
    hasSavedCard &&
    hasAvailableFunds &&
    !financeLoading &&
    !payoutMethodsLoading &&
    !isPayoutSubmitting;
  const isPayoutFormAvailable =
    hasSavedCard && availableForPayoutKopecks > 0 && !financeLoading;
  const payoutNoFundsMessage =
    availableForPayoutKopecks <= 0
      ? 'Сейчас нет доступной суммы для выплаты.'
      : null;
  const payoutAmountValidationError = (() => {
    if (!payoutAmountInput.trim()) return 'Введите сумму выплаты.';
    if (payoutAmountKopecks === null)
      return 'Введите корректную сумму (до 2 знаков после точки).';
    if (payoutAmountKopecks < payoutMinKopecks)
      return 'Минимальная сумма выплаты — 1 ₽.';
    if (payoutAmountKopecks > availableForPayoutKopecks)
      return 'Сумма больше доступного баланса.';
    if (payoutAmountKopecks > payoutMaxKopecks)
      return 'Максимальная выплата на карту — 150 000 ₽.';
    return null;
  })();
  const isAmountValid =
    hasSavedCard &&
    hasAvailableFunds &&
    !payoutAmountValidationError &&
    payoutAmountKopecks !== null;
  const payoutSummaryAmount =
    typeof payoutAmountKopecks === 'number' && payoutAmountKopecks > 0
      ? formatMoney({ kopecks: payoutAmountKopecks })
      : '—';
  const isPayoutSubmitDisabled =
    !isPayoutFormAvailable ||
    Boolean(payoutAmountValidationError) ||
    isPayoutSubmitting;
  const canSubmit = !isPayoutSubmitDisabled;
  const payoutInlineMessage =
    payoutSubmitError ?? payoutNoFundsMessage ?? payoutAmountValidationError;

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
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 960px)').matches;
    if (!isMobileViewport) return;

    if (!isMenuOpen && start.x <= 20 && deltaX > 70) {
      toggleSellerMenu();
      return;
    }

    if (isMenuOpen && deltaX < -70) {
      closeSellerMenu();
    }
  };

  const handleCreatePayoutMethod = async (
    payload: SellerPayoutMethodBindPayload
  ) => {
    setPayoutMethodError(null);
    setPayoutMethodSuccess(null);
    try {
      await sellerFinanceApi.createPayoutMethod(payload);
      await loadPayoutSettings();
      setPayoutBindExpanded(false);
      payoutWidgetRenderKeyRef.current = null;
      setPayoutWidgetInfo(null);
      setPayoutWidgetError(null);
      setPayoutMethodSuccess('Реквизиты для выплат успешно добавлены.');
    } catch (error) {
      const normalized = normalizeApiError(error);
      setPayoutMethodError(
        normalized.message ?? 'Не удалось добавить способ выплаты.'
      );
    }
  };

  const handleSetPayoutPart = (part: 0.25 | 0.5 | 1) => {
    if (!canEditPayoutAmount) return;
    const next = Math.max(0, Math.round(availableForPayoutKopecks * part));
    setPayoutAmountInput(kopecksToAmount(next));
    setPayoutSubmitError(null);
  };

  const executePayoutRequest = async (params: {
    amountKopecks: number;
    description: string;
    successTitle: string;
    includeDevRawResponse?: boolean;
  }) => {
    const {
      amountKopecks,
      description,
      successTitle,
      includeDevRawResponse = false
    } = params;
    setPayoutSubmitError(null);
    setPayoutRawError(null);
    setPayoutCreated(null);
    setPayoutResultTitle(null);
    setLastPayoutRawResponse(null);

    setPayoutSubmitting(true);
    try {
      const response = await sellerFinanceApi.triggerPayout({
        amount: kopecksToAmount(amountKopecks),
        description: description.trim() || 'Выплата продавцу Print-Form'
      });
      const payload = (response?.data ?? {}) as SellerPayoutCreateResponse;
      setPayoutCreated({
        ...payload,
        payoutId:
          (typeof payload.payoutId === 'string' && payload.payoutId) ||
          (typeof payload.id === 'string' && payload.id) ||
          null,
        status: typeof payload.status === 'string' ? payload.status : 'PENDING',
        amount: payload.amount ?? kopecksToAmount(amountKopecks),
        createdAt:
          typeof payload.createdAt === 'string'
            ? payload.createdAt
            : new Date().toISOString()
      });
      setPayoutResultTitle(successTitle);
      if (includeDevRawResponse) {
        setLastPayoutRawResponse(payload);
      }
      setPayoutAmountInput('');
      await loadFinanceData();
    } catch (error) {
      const normalized = normalizeApiError(error);
      setPayoutSubmitError(resolvePayoutSubmitErrorMessage(error));
      setPayoutRawError(normalized.message ?? getErrorMessage(error));
      if (
        includeDevRawResponse &&
        error &&
        typeof error === 'object' &&
        'payload' in error
      ) {
        setLastPayoutRawResponse(
          (error as { payload?: unknown }).payload ?? null
        );
      }
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const handleSubmitPayout = async () => {
    if (
      payoutNoFundsMessage ||
      payoutAmountValidationError ||
      payoutAmountKopecks === null
    ) {
      setPayoutSubmitError(
        payoutNoFundsMessage ??
          payoutAmountValidationError ??
          'Проверьте сумму выплаты.'
      );
      return;
    }
    await executePayoutRequest({
      amountKopecks: payoutAmountKopecks,
      description: payoutDescription,
      successTitle: 'Выплата создана'
    });
  };

  const handleDevTestPayout = async () => {
    await executePayoutRequest({
      amountKopecks: 10000,
      description: 'DEV TEST: фиксированная выплата',
      successTitle: 'Тестовая выплата создана',
      includeDevRawResponse: true
    });
  };

  const handleDevInputPayout = async () => {
    if (!payoutAmountInput.trim() || payoutAmountKopecks === null) {
      setPayoutSubmitError('Для dev выплаты введите корректную сумму.');
      return;
    }
    if (payoutAmountKopecks < payoutMinKopecks) {
      setPayoutSubmitError('Минимальная сумма dev-выплаты — 1 ₽.');
      return;
    }
    if (payoutAmountKopecks > payoutMaxKopecks) {
      setPayoutSubmitError('Максимальная сумма dev-выплаты — 150 000 ₽.');
      return;
    }
    await executePayoutRequest({
      amountKopecks: payoutAmountKopecks,
      description: `${payoutDescription.trim() || 'DEV payout'} [dev trigger]`,
      successTitle: 'Dev payout отправлен',
      includeDevRawResponse: true
    });
  };

  useEffect(() => {
    if (availableForPayoutKopecks <= 0 && payoutAmountInput) {
      setPayoutAmountInput('');
    }
  }, [availableForPayoutKopecks, payoutAmountInput]);

  const clearPayoutWidgetInstance = useCallback(() => {
    payoutWidgetInstanceRef.current?.clearListeners?.();
    payoutWidgetInstanceRef.current = null;
  }, []);

  const clearPayoutWidgetContainer = useCallback(() => {
    const container = document.getElementById(
      'yookassa-payouts-widget-container'
    );
    if (container) container.innerHTML = '';
  }, []);

  const handlePayoutWidgetSuccess = async (
    payload: YooKassaWidgetSuccessPayload
  ) => {
    const payoutToken = payload.payout_token ?? payload.payoutToken;
    if (!payoutToken) {
      setPayoutMethodError('Виджет не вернул токен привязки карты.');
      return;
    }

    setPayoutWidgetLoading(false);
    setPayoutWidgetStage('idle');
    setPayoutWidgetInfo('Карта успешно привязана. Сохраняем реквизиты...');
    setPayoutWidgetError(null);
    await handleCreatePayoutMethod({
      provider: 'YOOKASSA',
      methodType: 'BANK_CARD',
      payoutToken
    });
  };

  const handleBindCard = async () => {
    if (payoutMethodsUnauthorized) {
      setPayoutWidgetLoading(false);
      setPayoutWidgetStage('idle');
      setPayoutWidgetInfo(null);
      setPayoutWidgetError(
        'Не удалось получить данные по выплатам. Требуется повторная авторизация.'
      );
      return;
    }

    const resolvedConfig = resolvedPayoutWidgetConfig;
    console.log(
      '[widget] script loaded',
      Boolean((window as Window & { PayoutsData?: unknown }).PayoutsData)
    );
    console.log('[widget] accountId', resolvedConfig.accountId);
    console.log('[widget] enabled', resolvedConfig.enabled);
    console.log('[widget] hasSavedCard', resolvedConfig.hasSavedCard);

    if (!resolvedConfig.enabled) {
      setPayoutWidgetLoading(false);
      setPayoutWidgetStage('idle');
      setPayoutWidgetInfo(YOOKASSA_WIDGET_NOT_ENABLED_MESSAGE);
      setPayoutWidgetError(null);
      return;
    }
    if (resolvedConfig.type !== 'safedeal') {
      setPayoutWidgetLoading(false);
      setPayoutWidgetStage('idle');
      setPayoutWidgetInfo(YOOKASSA_WIDGET_INVALID_CONFIG_MESSAGE);
      setPayoutWidgetError(null);
      return;
    }
    if (!resolvedConfig.accountId) {
      setPayoutWidgetLoading(false);
      setPayoutWidgetStage('idle');
      setPayoutWidgetInfo(YOOKASSA_WIDGET_INVALID_CONFIG_MESSAGE);
      setPayoutWidgetError(null);
      return;
    }

    clearPayoutWidgetInstance();
    clearPayoutWidgetContainer();
    setPayoutWidgetLoading(true);
    setPayoutWidgetStage('script');
    setPayoutWidgetInfo(null);
    setPayoutWidgetError(null);

    const widget = await initYooKassaPayoutWidget({
      type: 'safedeal',
      accountId: resolvedConfig.accountId,
      containerId: 'yookassa-payouts-widget-container',
      onStageChange: (stage) => {
        setPayoutWidgetStage(stage);
      },
      onSuccess: (payload) => {
        void handlePayoutWidgetSuccess(payload);
      },
      onError: (error) => {
        setPayoutWidgetLoading(false);
        setPayoutWidgetStage('idle');
        setPayoutWidgetInfo(null);
        setPayoutWidgetError(error.message || YOOKASSA_WIDGET_ERROR_MESSAGE);
      }
    });
    payoutWidgetInstanceRef.current = widget;
    if (widget) {
      setPayoutWidgetLoading(false);
      setPayoutWidgetStage('idle');
    }
  };

  useEffect(() => {
    const widgetAllowed =
      resolvedPayoutWidgetConfig.enabled &&
      resolvedPayoutWidgetConfig.type === 'safedeal' &&
      Boolean(resolvedPayoutWidgetConfig.accountId) &&
      (!resolvedPayoutWidgetConfig.hasSavedCard || isPayoutBindExpanded);
    const shouldRender =
      activeItem === 'Настройки' &&
      !payoutMethodsLoading &&
      !payoutMethodError &&
      widgetAllowed;

    if (!shouldRender) {
      setPayoutWidgetStage('idle');
      setPayoutWidgetError(null);
      clearPayoutWidgetInstance();
      clearPayoutWidgetContainer();
      return;
    }

    if (payoutMethodsUnauthorized) {
      setPayoutWidgetLoading(false);
      setPayoutWidgetStage('idle');
      setPayoutWidgetInfo(null);
      setPayoutWidgetError(
        'Не удалось получить данные по выплатам. Требуется повторная авторизация.'
      );
      clearPayoutWidgetInstance();
      clearPayoutWidgetContainer();
      return;
    }

    if (!payoutWidgetConfig) {
      setPayoutWidgetLoading(false);
      setPayoutWidgetStage('idle');
      setPayoutWidgetInfo(YOOKASSA_WIDGET_LOADING_CONFIG_MESSAGE);
      setPayoutWidgetError('Не удалось загрузить конфигурацию выплат.');
      clearPayoutWidgetInstance();
      clearPayoutWidgetContainer();
      return;
    }

    const resolvedConfig = resolvedPayoutWidgetConfig;
    const mode = isPayoutBindExpanded ? 'rebind' : 'initial';
    const nextRenderKey = `${resolvedConfig.accountId}:${mode}`;
    if (!resolvedConfig.enabled) {
      setPayoutWidgetLoading(false);
      setPayoutWidgetStage('idle');
      setPayoutWidgetInfo(YOOKASSA_WIDGET_NOT_ENABLED_MESSAGE);
      setPayoutWidgetError(null);
      clearPayoutWidgetInstance();
      clearPayoutWidgetContainer();
      return;
    }
    if (!resolvedConfig.accountId) {
      setPayoutWidgetLoading(false);
      setPayoutWidgetStage('idle');
      setPayoutWidgetInfo(YOOKASSA_WIDGET_INVALID_CONFIG_MESSAGE);
      setPayoutWidgetError(null);
      clearPayoutWidgetInstance();
      clearPayoutWidgetContainer();
      return;
    }
    if (resolvedConfig.hasSavedCard && !isPayoutBindExpanded) {
      setPayoutWidgetLoading(false);
      setPayoutWidgetStage('idle');
      setPayoutWidgetInfo(null);
      setPayoutWidgetError(null);
      clearPayoutWidgetInstance();
      clearPayoutWidgetContainer();
      return;
    }
    if (payoutWidgetRenderKeyRef.current === nextRenderKey) return;
    payoutWidgetRenderKeyRef.current = nextRenderKey;
    void handleBindCard();
  }, [
    activeItem,
    clearPayoutWidgetContainer,
    clearPayoutWidgetInstance,
    isPayoutBindExpanded,
    payoutMethodError,
    payoutMethodsUnauthorized,
    payoutMethodsLoading,
    resolvedPayoutWidgetConfig
  ]);

  useEffect(
    () => () => {
      clearPayoutWidgetInstance();
    },
    [clearPayoutWidgetInstance]
  );

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
                        {isKycApproved
                          ? 'Статус подключения и подтвержденные данные профиля продавца.'
                          : 'Заполните данные продавца, выберите точку отгрузки и отправьте заявку на проверку.'}
                      </p>
                    </div>
                  </div>

                  {kycLoading ? (
                    <p className={styles.muted}>Загрузка статуса...</p>
                  ) : isKycApproved ? (
                    <div className={styles.kycApprovedPanel}>
                      <div className={styles.kycCompletedCard}>
                        <div className={styles.kycCompletedHeader}>
                          <Badge variant="success">Подключено</Badge>
                          <p className={styles.muted}>
                            Профиль продавца подтвержден
                          </p>
                        </div>
                        <p className={styles.helperText}>
                          Профиль продавца подтвержден. Управление реквизитами
                          для выплат доступно во вкладке «Настройки».
                        </p>
                      </div>

                      <div className={styles.settingsGrid}>
                        <div className={styles.kycRow}>
                          <span className={styles.kycLabel}>
                            Статус заявки:
                          </span>
                          <strong>
                            {kycStatusLabelRu(kycSubmission?.status)}
                          </strong>
                        </div>
                        <div className={styles.kycRow}>
                          <span className={styles.kycLabel}>Тип продавца:</span>
                          <strong>{sellerType ?? '—'}</strong>
                        </div>
                        {kycSubmission?.updatedAt && (
                          <div className={styles.kycRow}>
                            <span className={styles.kycLabel}>
                              Подтверждено:
                            </span>
                            <strong>
                              {formatDate(kycSubmission.updatedAt)}
                            </strong>
                          </div>
                        )}
                        {moderationComment && (
                          <p className={styles.kycNotes}>
                            Комментарий модерации: {moderationComment}
                          </p>
                        )}
                      </div>

                      <div className={styles.readonlyInfoCard}>
                        <h3>Подтвержденные данные продавца</h3>
                        <div className={styles.readonlyRows}>
                          {sellerIdentityRows.map((item) => (
                            <div
                              className={styles.readonlyRow}
                              key={item.label}
                            >
                              <span className={styles.kycLabel}>
                                {item.label}
                              </span>
                              <strong>{item.value}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={styles.readonlyInfoCard}>
                        <h3>Точка отгрузки</h3>
                        <p>
                          {hasDropoffPvz
                            ? dropoffPvzAddress || `Пункт ${dropoffPvzId}`
                            : 'Пока не выбрана'}
                        </p>
                        <p className={styles.helperText}>
                          Изменить точку отгрузки и реквизиты выплат можно во
                          вкладке «Настройки».
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.kycPanel}>
                      <div className={styles.kycRow}>
                        <span className={styles.kycLabel}>Статус:</span>
                        <strong>
                          {kycStatusLabelRu(kycSubmission?.status)}
                        </strong>
                      </div>

                      {moderationComment && (
                        <p className={styles.kycNotes}>
                          Комментарий: {moderationComment}
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
                        className={styles.formFieldset}
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
                            <span>
                              {formatPrice(resolvePriceMinorUnits(product))}
                            </span>
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
                  <div className={styles.ordersTabs}>
                    <button
                      type="button"
                      className={`${styles.ordersTabButton} ${ordersTab === 'ACTIVE' ? styles.ordersTabButtonActive : ''}`}
                      onClick={() => setOrdersTab('ACTIVE')}
                    >
                      Активные ({ordersTabCounts.ACTIVE})
                    </button>
                    <button
                      type="button"
                      className={`${styles.ordersTabButton} ${ordersTab === 'COMPLETED' ? styles.ordersTabButtonActive : ''}`}
                      onClick={() => setOrdersTab('COMPLETED')}
                    >
                      Завершённые ({ordersTabCounts.COMPLETED})
                    </button>
                    <button
                      type="button"
                      className={`${styles.ordersTabButton} ${ordersTab === 'CANCELLED' ? styles.ordersTabButtonActive : ''}`}
                      onClick={() => setOrdersTab('CANCELLED')}
                    >
                      Отменённые ({ordersTabCounts.CANCELLED})
                    </button>
                  </div>
                  <div className={styles.ordersSearchRow}>
                    <input
                      type="search"
                      className={styles.ordersSearchInput}
                      placeholder="Поиск по номеру заказа"
                      value={ordersSearchInput}
                      onChange={(event) =>
                        setOrdersSearchInput(event.target.value)
                      }
                    />
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
                        const total = order.items.reduce(
                          (sum, item) =>
                            sum + resolveOrderItemLineTotalKopecks(item),
                          0
                        );
                        const sellerNetAmount =
                          typeof order.sellerNetAmount === 'number'
                            ? order.sellerNetAmount
                            : total;
                        const isCancelled = order.status === 'CANCELLED';
                        const cancelPaymentHint =
                          order.paymentStatus === 'REFUND_PENDING'
                            ? 'Деньги возвращаются покупателю'
                            : order.paymentStatus === 'REFUNDED'
                              ? 'Деньги возвращены покупателю'
                              : null;

                        return (
                          <div key={order.id} className={styles.orderCard}>
                            <div className={styles.orderCardTop}>
                              <div className={styles.orderCardLeft}>
                                <div className={styles.cellTruncate}>
                                  <CopyableOrderNumber
                                    orderId={order.id}
                                    publicNumber={order.publicNumber}
                                    className={styles.orderIdText}
                                  />
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
                                  <strong>
                                    {formatPrice(sellerNetAmount)}
                                  </strong>
                                </div>
                                <p className={styles.muted}>
                                  Статус: {displayStatus}
                                </p>
                                {isCancelled && (
                                  <span className={styles.cancelledOrderBadge}>
                                    Заказ отменён
                                  </span>
                                )}
                                {cancelPaymentHint && (
                                  <p className={styles.muted}>
                                    {cancelPaymentHint}
                                  </p>
                                )}
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
                                  Выплата:{' '}
                                  {payoutStatusLabelRu(order.payoutStatus)}
                                </p>
                                <p className={styles.muted}>
                                  Сумма продавца: {formatPrice(sellerNetAmount)}
                                </p>
                                {order.yookassaDealId ? (
                                  <p className={styles.muted}>
                                    Safe Deal:{' '}
                                    {String(
                                      order.yookassaDealStatus ?? 'PENDING'
                                    )}
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

                              {!isCancelled ? (
                                <>
                                  <Button
                                    type="button"
                                    variant={
                                      order.isPacked ? 'ghost' : 'secondary'
                                    }
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
                                        onClick={() =>
                                          handleReadyToShip(order.id)
                                        }
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
                                        !order.shipment?.id &&
                                        !order.cdekOrderId
                                      }
                                    >
                                      Синхронизировать CDEK
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <p className={styles.muted}>
                                  Действия доставки недоступны для отменённого
                                  заказа.
                                </p>
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

                              {!isCancelled && (
                                <>
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
                                      !order.shipment?.id ||
                                      !order.trackingNumber
                                    }
                                  >
                                    Скачать ярлык
                                  </Button>

                                  {!order.trackingNumber && (
                                    <p className={styles.muted}>
                                      ещё формируется
                                    </p>
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
                                      handleDownloadAct(
                                        order.shipment.id,
                                        order.id
                                      )
                                    }
                                    disabled={
                                      !order.shipment?.id && !order.cdekOrderId
                                    }
                                  >
                                    Скачать акт
                                  </Button>
                                </>
                              )}
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
                        Только реальные суммы и статусы: что уже выплачено, что
                        в заморозке и что войдет в ближайшую выплату.
                      </p>
                    </div>
                  </div>
                  <div className={styles.ordersSearchRow}>
                    <input
                      type="search"
                      className={styles.ordersSearchInput}
                      placeholder="Поиск по номеру заказа"
                      value={ordersSearchInput}
                      onChange={(event) =>
                        setOrdersSearchInput(event.target.value)
                      }
                    />
                  </div>

                  {!financeData && financeError && (
                    <div className={styles.infoCard}>
                      <strong>Не удалось загрузить данные бухгалтерии.</strong>
                      <p className={styles.muted}>
                        Проверьте доступность API бухгалтерии и обновите
                        страницу.
                      </p>
                    </div>
                  )}

                  {financeData && (
                    <>
                      <div className={styles.financeSummaryGrid}>
                        <SellerStatsCard
                          title="Ожидает выплаты"
                          value={formatMoney({
                            kopecks: financeData.summary.awaitingPayoutKopecks
                          })}
                        />
                        <SellerStatsCard
                          title="Заморожено"
                          value={formatMoney({
                            kopecks: financeData.summary.frozenKopecks
                          })}
                        />
                        <SellerStatsCard
                          title="Выплачено"
                          value={formatMoney({
                            kopecks: financeData.summary.paidOutKopecks
                          })}
                        />
                        <SellerStatsCard
                          title="Возвраты / блокировки"
                          value={formatMoney({
                            kopecks: financeData.summary.adjustmentsKopecks
                          })}
                        />
                      </div>

                      <div className={styles.financePanel}>
                        <h3>Вывод средств</h3>
                        <div className={styles.payoutFormTop}>
                          <div>
                            <p className={styles.muted}>Доступно к выплате</p>
                            <strong>
                              {formatMoney({
                                kopecks: availableForPayoutKopecks
                              })}
                            </strong>
                          </div>
                          <div>
                            <p className={styles.muted}>Способ выплаты</p>
                            {hasSavedCard ? (
                              <>
                                <strong>{savedCardMeta.cardLabel}</strong>
                                {!savedCardMeta.hasCardMaskData && (
                                  <p className={styles.muted}>
                                    Данные маски карты пока недоступны.
                                  </p>
                                )}
                                {!savedCardMeta.hasCardMaskData &&
                                  isDevPayoutToolsEnabled && (
                                    <p className={styles.muted}>
                                      Данные маски карты пока не получены от
                                      сервера.
                                    </p>
                                  )}
                                {savedCardMeta.issuerName && (
                                  <p className={styles.muted}>
                                    Банк: {savedCardMeta.issuerName}
                                  </p>
                                )}
                                <p className={styles.muted}>
                                  Карта привязана · Обновлено{' '}
                                  {savedCardMeta.updatedAt
                                    ? formatDate(savedCardMeta.updatedAt)
                                    : formatDate(new Date().toISOString())}
                                </p>
                              </>
                            ) : (
                              <span className={styles.muted}>
                                Карта не привязана
                              </span>
                            )}
                          </div>
                        </div>
                        {!hasSavedCard ? (
                          <div className={styles.infoCard}>
                            <strong>
                              Сначала привяжите карту для выплат в настройках.
                            </strong>
                            <p className={styles.muted}>
                              <button
                                type="button"
                                className={styles.inlineLinkButton}
                                onClick={() => setActiveItem('Настройки')}
                              >
                                Перейти в настройки
                              </button>
                            </p>
                          </div>
                        ) : (
                          <div className={styles.payoutForm}>
                            <label
                              className={styles.fieldLabel}
                              htmlFor="payout-amount"
                            >
                              Сумма выплаты
                            </label>
                            <input
                              id="payout-amount"
                              className={styles.ordersSearchInput}
                              inputMode="decimal"
                              placeholder="0.00"
                              value={payoutAmountInput}
                              onChange={(event) => {
                                setPayoutAmountInput(
                                  normalizePayoutAmountInput(event.target.value)
                                );
                                setPayoutSubmitError(null);
                                setPayoutRawError(null);
                              }}
                              disabled={!canEditPayoutAmount}
                            />
                            <div className={styles.payoutQuickActions}>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleSetPayoutPart(0.25)}
                                disabled={!canEditPayoutAmount}
                              >
                                25%
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleSetPayoutPart(0.5)}
                                disabled={!canEditPayoutAmount}
                              >
                                50%
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleSetPayoutPart(1)}
                                disabled={!canEditPayoutAmount}
                              >
                                100%
                              </Button>
                            </div>
                            <label
                              className={styles.fieldLabel}
                              htmlFor="payout-description"
                            >
                              Комментарий / назначение
                            </label>
                            <input
                              id="payout-description"
                              className={styles.ordersSearchInput}
                              value={payoutDescription}
                              onChange={(event) =>
                                setPayoutDescription(event.target.value)
                              }
                              disabled={isPayoutSubmitting}
                            />
                            <div className={styles.infoCard}>
                              <p>
                                Сумма выплаты:{' '}
                                <strong>{payoutSummaryAmount}</strong>
                              </p>
                              <p>
                                К получению:{' '}
                                <strong>{payoutSummaryAmount}</strong>
                              </p>
                            </div>
                            {payoutInlineMessage && (
                              <p className={styles.error}>
                                {payoutInlineMessage}
                              </p>
                            )}
                            <Button
                              type="button"
                              onClick={() => void handleSubmitPayout()}
                              disabled={isPayoutSubmitDisabled}
                            >
                              {isPayoutSubmitting
                                ? 'Отправляем выплату...'
                                : 'Вывести средства'}
                            </Button>
                            <p className={styles.muted}>
                              Минимальная выплата: 1 ₽. Максимальная выплата на
                              карту: 150 000 ₽. После отправки выплата может
                              находиться в статусе обработки.
                            </p>
                          </div>
                        )}

                        {payoutCreated && (
                          <div className={styles.infoCard}>
                            <strong>
                              {payoutResultTitle ?? 'Успех: выплата создана'}
                            </strong>
                            <p>
                              ID выплаты:{' '}
                              {String(
                                payoutCreated.payoutId ??
                                  payoutCreated.id ??
                                  '—'
                              )}
                            </p>
                            <p>
                              Сумма:{' '}
                              {typeof payoutCreated.amount === 'number'
                                ? formatMoneyRub(payoutCreated.amount)
                                : `${String(payoutCreated.amount ?? '—')} ₽`}
                            </p>
                            <p>
                              Статус:{' '}
                              {payoutStatusLabelRu(
                                String(payoutCreated.status ?? 'PENDING')
                              )}
                            </p>
                            <p>
                              Дата создания:{' '}
                              {payoutCreated.createdAt
                                ? formatDate(String(payoutCreated.createdAt))
                                : '—'}
                            </p>
                            {isDevPayoutToolsEnabled &&
                              Boolean(lastPayoutRawResponse) && (
                                <pre className={styles.codeBlock}>
                                  {JSON.stringify(
                                    lastPayoutRawResponse,
                                    null,
                                    2
                                  )}
                                </pre>
                              )}
                            <div className={styles.payoutBindActions}>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => void loadFinanceData()}
                              >
                                Обновить статус
                              </Button>
                            </div>
                          </div>
                        )}
                        {payoutRawError && isDevPayoutToolsEnabled && (
                          <div className={styles.infoCard}>
                            <strong>Ошибка payout</strong>
                            <p>{payoutRawError}</p>
                            {Boolean(lastPayoutRawResponse) && (
                              <pre className={styles.codeBlock}>
                                {JSON.stringify(lastPayoutRawResponse, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                        {shouldShowDevPayoutTools && (
                          <div className={styles.devPayoutTools}>
                            <div className={styles.devPayoutTitle}>
                              Тестирование выплат
                            </div>
                            <div className={styles.devPayoutButtons}>
                              <button
                                type="button"
                                onClick={() => void handleDevTestPayout()}
                                disabled={isPayoutSubmitting}
                              >
                                Тестовая выплата 100 ₽
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDevInputPayout()}
                                disabled={isPayoutSubmitting}
                              >
                                Тестовая выплата введенной суммы
                              </button>
                            </div>
                            {isDevPayoutToolsEnabled && (
                              <div className={styles.devPayoutDebug}>
                                <div>hasSavedCard = {String(hasSavedCard)}</div>
                                <div>
                                  availableToPayoutMinor ={' '}
                                  {String(availableForPayoutKopecks)}
                                </div>
                                <div>amountInput = {payoutAmountInput}</div>
                                <div>
                                  isAmountValid = {String(isAmountValid)}
                                </div>
                                <div>canSubmit = {String(canSubmit)}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className={styles.financePanel}>
                        <h3>Ближайшая выплата</h3>
                        {financeData.nextPayout.orderCount === 0 ? (
                          <div className={styles.infoCard}>
                            <strong>
                              Будет доступно после настройки выплат
                            </strong>
                            <p className={styles.muted}>
                              Как только появятся заказы в очереди, здесь
                              отобразятся дата, сумма и количество заказов.
                            </p>
                          </div>
                        ) : (
                          <div className={styles.nextPayoutGrid}>
                            <div>
                              <p className={styles.muted}>Дата</p>
                              <strong>
                                {financeData.nextPayout.scheduledAt
                                  ? formatDate(
                                      financeData.nextPayout.scheduledAt
                                    )
                                  : 'Дата уточняется'}
                              </strong>
                            </div>
                            <div>
                              <p className={styles.muted}>Сумма</p>
                              <strong>
                                {formatMoney({
                                  kopecks: financeData.nextPayout.amountKopecks
                                })}
                              </strong>
                            </div>
                            <div>
                              <p className={styles.muted}>Заказов</p>
                              <strong>
                                {financeData.nextPayout.orderCount}
                              </strong>
                            </div>
                            <div>
                              <p className={styles.muted}>График выплат</p>
                              <strong>
                                {payoutScheduleLabelRu(
                                  financeData.nextPayout.payoutScheduleType
                                )}
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>

                      {financeData && (
                        <div className={styles.financePanel}>
                          <h3>Очередь на выплату</h3>
                          {financeData.payoutQueue.length === 0 ? (
                            <p className={styles.muted}>
                              Нет заказов в очереди на выплату.
                            </p>
                          ) : (
                            <>
                              <SellerFinanceTable
                                rows={financeData.payoutQueue}
                                rowKey={(item) => item.payoutId}
                                desktopContainerClassName={
                                  styles.financeRowsDesktop
                                }
                                headerClassName={styles.financeTableHeader}
                                rowClassName={styles.financeTableRow}
                                templateClassName={styles.financeQueueTemplate}
                                columns={[
                                  {
                                    key: 'order',
                                    title: 'Заказ',
                                    render: (item) => (
                                      <CopyableOrderNumber
                                        orderId={item.orderId}
                                        publicNumber={item.publicNumber}
                                        className={styles.orderIdText}
                                      />
                                    )
                                  },
                                  {
                                    key: 'date',
                                    title: 'Доступно к выплате / Дата',
                                    render: (item) =>
                                      item.status === 'HOLD'
                                        ? `Заморожено до ${item.eligibleAt ? formatDate(item.eligibleAt) : 'даты уточнения'}`
                                        : item.eligibleAt
                                          ? `Доступно с ${formatDate(item.eligibleAt)}`
                                          : 'Доступно к выплате'
                                  },
                                  {
                                    key: 'amount',
                                    title: 'Сумма заказа',
                                    render: (item) =>
                                      formatMoney({
                                        kopecks: item.amountKopecks
                                      })
                                  },
                                  {
                                    key: 'fee',
                                    title: 'Комиссия платформы',
                                    render: (item) =>
                                      formatMoney({
                                        kopecks: item.platformFeeKopecks
                                      })
                                  },
                                  {
                                    key: 'net',
                                    title: 'К выплате продавцу',
                                    render: (item) =>
                                      formatMoney({
                                        kopecks: item.sellerNetAmountKopecks
                                      })
                                  },
                                  {
                                    key: 'status',
                                    title: 'Статус',
                                    render: (item) =>
                                      payoutStatusLabelRu(item.status)
                                  }
                                ]}
                              />
                              <SellerFinanceMobileCard
                                rows={financeData.payoutQueue}
                                rowKey={(item) => item.payoutId}
                                cardsContainerClassName={
                                  styles.financeCardsMobile
                                }
                                cardClassName={styles.financeMobileCard}
                                labelClassName={styles.financeMobileLabel}
                                fields={[
                                  {
                                    key: 'order',
                                    label: 'Заказ',
                                    render: (item) => (
                                      <CopyableOrderNumber
                                        orderId={item.orderId}
                                        publicNumber={item.publicNumber}
                                        className={styles.orderIdText}
                                      />
                                    )
                                  },
                                  {
                                    key: 'date',
                                    label: 'Доступно к выплате',
                                    render: (item) =>
                                      item.status === 'HOLD'
                                        ? `Заморожено до ${item.eligibleAt ? formatDate(item.eligibleAt) : 'даты уточнения'}`
                                        : item.eligibleAt
                                          ? `Доступно с ${formatDate(item.eligibleAt)}`
                                          : 'Доступно к выплате'
                                  },
                                  {
                                    key: 'amount',
                                    label: 'Сумма заказа',
                                    render: (item) =>
                                      formatMoney({
                                        kopecks: item.amountKopecks
                                      })
                                  },
                                  {
                                    key: 'fee',
                                    label: 'Комиссия платформы',
                                    render: (item) =>
                                      formatMoney({
                                        kopecks: item.platformFeeKopecks
                                      })
                                  },
                                  {
                                    key: 'net',
                                    label: 'К выплате продавцу',
                                    render: (item) =>
                                      formatMoney({
                                        kopecks: item.sellerNetAmountKopecks
                                      })
                                  },
                                  {
                                    key: 'status',
                                    label: 'Статус',
                                    render: (item) =>
                                      payoutStatusLabelRu(item.status)
                                  }
                                ]}
                              />
                            </>
                          )}
                        </div>
                      )}

                      {financeData && (
                        <div className={styles.financePanel}>
                          <h3>Возвраты и блокировки</h3>
                          {financeData.adjustments.length === 0 ? (
                            <p className={styles.muted}>
                              Возвратов и удержаний пока нет.
                            </p>
                          ) : (
                            <>
                              <SellerFinanceTable
                                rows={financeData.adjustments}
                                rowKey={(item) => item.adjustmentId}
                                desktopContainerClassName={
                                  styles.financeRowsDesktop
                                }
                                headerClassName={styles.financeTableHeader}
                                rowClassName={styles.financeAdjustmentsRow}
                                templateClassName={
                                  styles.financeAdjustmentsTemplate
                                }
                                columns={[
                                  {
                                    key: 'order',
                                    title: 'Заказ',
                                    render: (item) => (
                                      <CopyableOrderNumber
                                        orderId={item.orderId}
                                        publicNumber={item.publicNumber}
                                        className={styles.orderIdText}
                                      />
                                    )
                                  },
                                  {
                                    key: 'date',
                                    title: 'Дата',
                                    render: (item) => formatDate(item.createdAt)
                                  },
                                  {
                                    key: 'amount',
                                    title: 'Сумма',
                                    render: (item) =>
                                      formatMoney({
                                        kopecks: item.amountKopecks
                                      })
                                  },
                                  {
                                    key: 'type',
                                    title: 'Тип',
                                    render: (item) =>
                                      adjustmentTypeLabelRu(item.type)
                                  },
                                  {
                                    key: 'description',
                                    title: 'Описание',
                                    render: (item) =>
                                      [
                                        item.description,
                                        payoutCancelReasonLabelRu(
                                          item.cancellationReason
                                        )
                                      ]
                                        .filter(Boolean)
                                        .join(' · ') || '—'
                                  },
                                  {
                                    key: 'status',
                                    title: 'Статус',
                                    render: (item) =>
                                      payoutStatusLabelRu(item.status)
                                  }
                                ]}
                              />
                              <SellerFinanceMobileCard
                                rows={financeData.adjustments}
                                rowKey={(item) => item.adjustmentId}
                                cardsContainerClassName={
                                  styles.financeCardsMobile
                                }
                                cardClassName={styles.financeMobileCard}
                                labelClassName={styles.financeMobileLabel}
                                fields={[
                                  {
                                    key: 'order',
                                    label: 'Заказ',
                                    render: (item) => (
                                      <CopyableOrderNumber
                                        orderId={item.orderId}
                                        publicNumber={item.publicNumber}
                                        className={styles.orderIdText}
                                      />
                                    )
                                  },
                                  {
                                    key: 'date',
                                    label: 'Дата',
                                    render: (item) => formatDate(item.createdAt)
                                  },
                                  {
                                    key: 'amount',
                                    label: 'Сумма',
                                    render: (item) =>
                                      formatMoney({
                                        kopecks: item.amountKopecks
                                      })
                                  },
                                  {
                                    key: 'type',
                                    label: 'Тип',
                                    render: (item) =>
                                      adjustmentTypeLabelRu(item.type)
                                  },
                                  {
                                    key: 'description',
                                    label: 'Описание',
                                    render: (item) =>
                                      [
                                        item.description,
                                        payoutCancelReasonLabelRu(
                                          item.cancellationReason
                                        )
                                      ]
                                        .filter(Boolean)
                                        .join(' · ') || '—'
                                  },
                                  {
                                    key: 'status',
                                    label: 'Статус',
                                    render: (item) =>
                                      payoutStatusLabelRu(item.status)
                                  }
                                ]}
                              />
                            </>
                          )}
                        </div>
                      )}

                      {financeData && (
                        <div className={styles.financePanel}>
                          <h3>История выплат</h3>
                          {financeData.payoutHistory.length === 0 ? (
                            <div className={styles.infoCard}>
                              <strong>Выплат пока не было</strong>
                              <p className={styles.muted}>
                                Когда выплаты продавцу появятся, здесь
                                отобразится реальная история перечислений.
                              </p>
                            </div>
                          ) : (
                            <>
                              <SellerFinanceTable
                                rows={financeData.payoutHistory}
                                rowKey={(item) =>
                                  `${item.payoutId}-${item.orderId}`
                                }
                                desktopContainerClassName={
                                  styles.financeRowsDesktop
                                }
                                headerClassName={styles.financeTableHeader}
                                rowClassName={styles.financeTableRow}
                                templateClassName={
                                  styles.financePayoutHistoryTemplate
                                }
                                columns={[
                                  {
                                    key: 'payoutId',
                                    title: 'Payout ID',
                                    render: (item) => item.payoutId
                                  },
                                  {
                                    key: 'date',
                                    title: 'Дата',
                                    render: (item) =>
                                      formatDate(
                                        item.succeededAt ?? item.createdAt
                                      )
                                  },
                                  {
                                    key: 'amount',
                                    title: 'Сумма',
                                    render: (item) =>
                                      formatMoney({
                                        kopecks: item.amountKopecks
                                      })
                                  },
                                  {
                                    key: 'method',
                                    title: 'Способ выплаты',
                                    render: (item) =>
                                      item.payoutMethodSummary ?? '—'
                                  },
                                  {
                                    key: 'description',
                                    title: 'Описание',
                                    render: (item) =>
                                      item.publicNumber
                                        ? `Заказ ${item.publicNumber}`
                                        : 'Выплата продавцу'
                                  },
                                  {
                                    key: 'status',
                                    title: 'Статус',
                                    render: (item) =>
                                      payoutStatusLabelRu(item.status)
                                  }
                                ]}
                              />
                              <SellerFinanceMobileCard
                                rows={financeData.payoutHistory}
                                rowKey={(item) =>
                                  `${item.payoutId}-${item.orderId}`
                                }
                                cardsContainerClassName={
                                  styles.financeCardsMobile
                                }
                                cardClassName={styles.financeMobileCard}
                                labelClassName={styles.financeMobileLabel}
                                fields={[
                                  {
                                    key: 'payoutId',
                                    label: 'Payout ID',
                                    render: (item) => item.payoutId
                                  },
                                  {
                                    key: 'date',
                                    label: 'Дата',
                                    render: (item) =>
                                      formatDate(
                                        item.succeededAt ?? item.createdAt
                                      )
                                  },
                                  {
                                    key: 'amount',
                                    label: 'Сумма',
                                    render: (item) =>
                                      formatMoney({
                                        kopecks: item.amountKopecks
                                      })
                                  },
                                  {
                                    key: 'method',
                                    label: 'Способ выплаты',
                                    render: (item) =>
                                      item.payoutMethodSummary ?? '—'
                                  },
                                  {
                                    key: 'description',
                                    label: 'Описание',
                                    render: (item) =>
                                      item.publicNumber
                                        ? `Заказ ${item.publicNumber}`
                                        : 'Выплата продавцу'
                                  },
                                  {
                                    key: 'status',
                                    label: 'Статус',
                                    render: (item) =>
                                      payoutStatusLabelRu(item.status)
                                  }
                                ]}
                              />
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {financeLoading && (
                    <p className={styles.muted}>
                      Загрузка финансовых операций Safe Deal...
                    </p>
                  )}
                  {financeError && (
                    <p className={styles.error}>{financeError}</p>
                  )}

                  <div className={styles.financeHintList}>
                    <p>
                      <strong>Ожидает выплаты</strong> — деньги по заказам,
                      готовым к перечислению.
                    </p>
                    <p>
                      <strong>Заморожено</strong> — оплаченные заказы до
                      завершения сценария.
                    </p>
                    <p>
                      <strong>Выплачено</strong> — уже перечислено продавцу.
                    </p>
                    <p>
                      <strong>Возвраты / удержания</strong> — отмены, возвраты и
                      блокировки.
                    </p>
                  </div>
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
                      <p>
                        Рабочие настройки продавца, точка отгрузки и реквизиты
                        для выплат.
                      </p>
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
                    Здесь управляются операционные настройки. Статус подключения
                    и KYC остаются во вкладке «Подключение».
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
                          className={`${styles.error} ${styles.deliveryError}`}
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

                  {renderPayoutMethodsSettingsBlock()}
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
type PayoutWidgetStage = 'idle' | 'script' | 'widget';
