// frontend/src/shared/lib/yaNddWidget.ts
const SRC = 'https://ndd-widget.landpro.site/widget.js';
const SCRIPT_ID = 'ya-ndd-widget';

declare global {
  interface Window {
    YaDelivery?: {
      createWidget: (config: { containerId: string; params: Record<string, unknown> }) => void;
      setParams?: (params: Record<string, unknown>) => void;
    };
  }
}

function waitEvent(name: string) {
  return new Promise<void>((resolve) => {
    document.addEventListener(name, () => resolve(), { once: true });
  });
}

export async function ensureYaNddWidgetLoaded(): Promise<void> {
  if (window.YaDelivery?.createWidget) return;

  if (!document.getElementById(SCRIPT_ID)) {
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = SRC;
    s.async = true;
    document.head.appendChild(s);
  }

  // по доке: если YaDelivery ещё нет, ждать YaNddWidgetLoad
  if (!window.YaDelivery?.createWidget) {
    await waitEvent('YaNddWidgetLoad');
  }

  // микротик (иногда API цепляется не синхронно)
  if (!window.YaDelivery?.createWidget) {
    await new Promise((r) => setTimeout(r, 0));
  }

  if (!window.YaDelivery?.createWidget) {
    throw new Error('YA_NDD_WIDGET_NOT_READY');
  }
}
