const YOOKASSA_PAYOUT_WIDGET_SRC =
  'https://yookassa.ru/payouts-data/3.1.0/widget.js';

type YooKassaPayoutWidgetOptions = {
  type: 'safedeal';
  accountId: string;
  containerId: string;
  onSuccess: (payoutToken: string) => void;
  onError: (error: Error) => void;
};

type PayoutsDataInstance = {
  render: (container: string | HTMLElement) => void;
};

type PayoutsDataConstructor = new (params: {
  type: 'safedeal';
  account_id: string;
  success_callback: (payload: { payoutToken?: string; payout_token?: string }) => void;
  error_callback: (payload?: unknown) => void;
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

const ensureYooKassaPayoutScript = async (): Promise<void> => {
  const runtime = window as GlobalWithYooKassa;
  if (runtime.PayoutsData) return;

  if (!runtime.__pfYooKassaPayoutWidgetLoadingPromise) {
    runtime.__pfYooKassaPayoutWidgetLoadingPromise = new Promise<void>(
      (resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>(
          `script[src=\"${YOOKASSA_PAYOUT_WIDGET_SRC}\"]`
        );

        if (existingScript) {
          existingScript.addEventListener('load', () => resolve(), { once: true });
          existingScript.addEventListener(
            'error',
            () => reject(new Error('Не удалось загрузить форму YooKassa.')),
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

  await runtime.__pfYooKassaPayoutWidgetLoadingPromise;

  if (!runtime.PayoutsData) {
    throw new Error('Форма YooKassa недоступна. Попробуйте позже.');
  }
};

export const initYooKassaPayoutWidget = async (
  options: YooKassaPayoutWidgetOptions
) => {
  try {
    await ensureYooKassaPayoutScript();
    const runtime = window as GlobalWithYooKassa;
    const Widget = runtime.PayoutsData;
    if (!Widget) {
      throw new Error('Форма YooKassa недоступна. Попробуйте позже.');
    }

    const widget = new Widget({
      type: options.type,
      account_id: options.accountId,
      success_callback: (payload) => {
        const payoutToken = payload?.payoutToken ?? payload?.payout_token;
        if (!payoutToken) {
          options.onError(new Error('Виджет не вернул токен карты.'));
          return;
        }
        options.onSuccess(payoutToken);
      },
      error_callback: (payload) => {
        options.onError(toWidgetError(payload));
      }
    });

    widget.render(options.containerId);
  } catch (error) {
    options.onError(toWidgetError(error));
  }
};
