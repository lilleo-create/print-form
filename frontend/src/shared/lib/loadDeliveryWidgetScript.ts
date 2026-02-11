const DELIVERY_WIDGET_SCRIPT_SRC = 'https://ndd-widget.landpro.site/widget.js';
const SCRIPT_ID = 'ya-delivery-widget-script';

let scriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    YaDelivery?: {
      createWidget: (config: { containerId: string; params: Record<string, unknown> }) => void;
    };
  }
}

export const loadDeliveryWidgetScript = () => {
  if (window.YaDelivery) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Не удалось загрузить виджет доставки.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = DELIVERY_WIDGET_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Не удалось загрузить виджет доставки.'));
    document.body.appendChild(script);
  });

  return scriptPromise;
};
