type YooKassaPayoutWidgetOptions = {
  type: 'safedeal';
  config?: Record<string, unknown> | null;
  containerId?: string;
  onSuccess: (payoutToken: string) => void;
  onError: (error: Error) => void;
};

type GlobalWithYooKassa = Window & {
  YooKassaPayoutsWidget?: {
    open: (params: Record<string, unknown>) => Promise<{ payoutToken: string }>;
  };
};

export const initYooKassaPayoutWidget = async (
  options: YooKassaPayoutWidgetOptions
) => {
  const runtime = window as GlobalWithYooKassa;
  const widget = runtime.YooKassaPayoutsWidget;

  if (!widget) {
    options.onError(
      new Error(
        'Виджет YooKassa payouts-data пока не подключён. Обратитесь в поддержку платформы.'
      )
    );
    return;
  }

  try {
    const result = await widget.open({
      ...(options.config ?? {}),
      ...(options.containerId ? { container: `#${options.containerId}` } : {}),
      type: options.type
    });
    if (!result?.payoutToken) {
      throw new Error('Виджет не вернул payoutToken.');
    }
    options.onSuccess(result.payoutToken);
  } catch (error) {
    options.onError(error instanceof Error ? error : new Error(String(error)));
  }
};
