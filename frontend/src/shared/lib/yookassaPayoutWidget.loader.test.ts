import { afterEach, describe, expect, it } from 'vitest';
import { loadYooKassaWidgetScript } from './yookassaPayoutWidget';

const widgetUrl = 'https://yookassa.ru/payouts-data/3.1.0/widget.js';
type WidgetRuntime = Window & { PayoutsData?: unknown; __pfYooKassaPayoutWidgetLoadingPromise?: Promise<void> };

afterEach(() => {
  document.querySelector(`script[src="${widgetUrl}"]`)?.remove();
  delete (window as WidgetRuntime).PayoutsData;
  delete (window as WidgetRuntime).__pfYooKassaPayoutWidgetLoadingPromise;
});

describe('YooKassa payout script loader', () => {
  it('injects on demand and deduplicates later calls', async () => {
    expect(document.querySelector(`script[src="${widgetUrl}"]`)).toBeNull();
    const pending = loadYooKassaWidgetScript();
    const script = document.querySelector<HTMLScriptElement>(`script[src="${widgetUrl}"]`);
    expect(script).not.toBeNull();
    (window as WidgetRuntime).PayoutsData = class {};
    script!.dispatchEvent(new Event('load'));
    await pending;
    await loadYooKassaWidgetScript();
    expect(document.querySelectorAll(`script[src="${widgetUrl}"]`)).toHaveLength(1);
  });
});
