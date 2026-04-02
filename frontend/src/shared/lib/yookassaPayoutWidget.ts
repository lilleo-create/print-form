const YOOKASSA_PAYOUT_WIDGET_SRC =
  'https://yookassa.ru/payouts-data/3.1.0/widget.js';

type YooKassaPayoutWidgetOptions = {
  type: 'safedeal';
  accountId: string;
  containerId: string;
  onStageChange?: (stage: 'script' | 'widget') => void;
  onSuccess: (payload: YooKassaWidgetSuccessPayload) => void;
  onError: (error: Error) => void;
};

export type YooKassaWidgetSuccessPayload = {
  payout_token?: string;
  payoutToken?: string;
  first6?: string;
  last4?: string;
  issuer_name?: string;
  issuer_country?: string;
  card_type?: string;
};

type PayoutsDataInstance = {
  render: (container: string | HTMLElement) => Promise<void> | void;
  clearListeners?: () => void;
};

type PayoutsDataConstructor = new (params: {
  type: 'safedeal';
  account_id: string;
  success_callback: (payload: YooKassaWidgetSuccessPayload) => void;
  error_callback: (payload?: unknown) => void;
  lang?: 'ru_RU';
  customization?: {
    colors: {
      background: string;
      text: string;
      border: string;
      control_secondary: string;
      control_primary: string;
      control_primary_content: string;
    };
  };
}) => PayoutsDataInstance;

type GlobalWithYooKassa = Window & {
  PayoutsData?: PayoutsDataConstructor;
  __pfYooKassaPayoutWidgetLoadingPromise?: Promise<void>;
};

const toWidgetError = (payload: unknown): Error => {
  if (payload instanceof Error) return payload;
  if (typeof payload === 'string' && payload.trim()) return new Error(payload);
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return new Error(message);
  }
  return new Error('Не удалось привязать карту. Попробуйте ещё раз.');
};

export const mapYooKassaWidgetErrorCode = (code: string): string => {
  switch (code) {
    case 'card_country_code_error':
      return 'На эту карту нельзя проводить выплаты. Используйте другую карту.';
    case 'card_unknown_country_code_error':
      return 'Не удалось определить страну выпуска карты. Проверьте номер карты или используйте другую карту.';
    case 'internal_service_error':
      return 'Ошибка сервиса YooKassa. Попробуйте снова.';
    default:
      return 'Не удалось привязать карту. Попробуйте еще раз.';
  }
};

const normalizeWidgetError = (payload: unknown): Error => {
  if (typeof payload === 'string' && payload.trim()) {
    return new Error(mapYooKassaWidgetErrorCode(payload.trim()));
  }
  if (payload && typeof payload === 'object' && 'code' in payload) {
    const code = (payload as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim()) {
      return new Error(mapYooKassaWidgetErrorCode(code.trim()));
    }
  }
  return toWidgetError(payload);
};

export const loadYooKassaWidgetScript = async (): Promise<void> => {
  const runtime = window as GlobalWithYooKassa;
  console.log('[YK widget] window.PayoutsData before load:', !!runtime.PayoutsData);
  if (runtime.PayoutsData) return;

  if (!runtime.__pfYooKassaPayoutWidgetLoadingPromise) {
    console.log('[YK widget] start script load');
    runtime.__pfYooKassaPayoutWidgetLoadingPromise = new Promise<void>(
      (resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>(
          `script[src="${YOOKASSA_PAYOUT_WIDGET_SRC}"]`
        );
        console.log('[YK widget] script exists before load:', !!existingScript);

        if (existingScript) {
          if (runtime.PayoutsData) {
            resolve();
            return;
          }
          const timeoutId = window.setTimeout(() => resolve(), 5000);
          existingScript.addEventListener('load', () => resolve(), { once: true });
          existingScript.addEventListener(
            'error',
            () => {
              window.clearTimeout(timeoutId);
              reject(new Error('Не удалось загрузить форму YooKassa.'));
            },
            { once: true }
          );
          existingScript.addEventListener(
            'load',
            () => window.clearTimeout(timeoutId),
            { once: true }
          );
          return;
        }

        const script = document.createElement('script');
        script.src = YOOKASSA_PAYOUT_WIDGET_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Не удалось загрузить форму YooKassa.'));
        document.head.appendChild(script);
      }
    );
  }

  try {
    await runtime.__pfYooKassaPayoutWidgetLoadingPromise;
    console.log('[YK widget] script load success');
  } catch (error) {
    runtime.__pfYooKassaPayoutWidgetLoadingPromise = undefined;
    throw error;
  }

  console.log('[YK widget] window.PayoutsData after load:', !!runtime.PayoutsData);
  if (!runtime.PayoutsData) {
    throw new Error('Форма YooKassa недоступна. Попробуйте позже.');
  }
};

export const loadYooKassaPayoutWidgetScript = loadYooKassaWidgetScript;

export const initYooKassaPayoutWidget = async (
  options: YooKassaPayoutWidgetOptions
) => {
  try {
    options.onStageChange?.('script');
    await loadYooKassaWidgetScript();
    const runtime = window as GlobalWithYooKassa;
    const Widget = runtime.PayoutsData;
    if (!Widget) {
      throw new Error('Форма YooKassa недоступна. Попробуйте позже.');
    }

    console.log('[YK widget] create instance');
    if (!options.accountId?.trim()) {
      throw new Error('Не передан shopid для YooKassa Safe Deal.');
    }
    const widget = new Widget({
      type: 'safedeal',
      account_id: options.accountId,
      lang: 'ru_RU',
      customization: {
        colors: {
          background: '#08111F',
          text: '#F3F7FF',
          border: '#22385A',
          control_secondary: '#7F97B8',
          control_primary: '#3B82F6',
          control_primary_content: '#FFFFFF'
        }
      },
      success_callback: (payload) => {
        const payoutToken = payload?.payoutToken ?? payload?.payout_token;
        if (!payoutToken) {
          options.onError(new Error('Виджет не вернул токен карты.'));
          return;
        }
        options.onSuccess(payload);
      },
      error_callback: (payload) => {
        options.onError(normalizeWidgetError(payload));
      }
    });

    options.onStageChange?.('widget');
    console.log('[YK widget] start render');
    await widget.render(options.containerId);
    console.log('[YK widget] render success');
    return widget;
  } catch (error) {
    console.error('[YK widget] render failed', error);
    options.onError(toWidgetError(error));
    return null;
  }
};
