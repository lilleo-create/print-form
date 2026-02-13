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

let loadPromise: Promise<void> | null = null;

function waitEvent(name: string) {
  return new Promise<void>((resolve) => {
    document.addEventListener(name, () => resolve(), { once: true });
  });
}

async function loadWidgetScript() {
  if (window.YaDelivery?.createWidget) return;

  if (!document.getElementById(SCRIPT_ID)) {
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = SRC;
    s.async = true;
    document.head.appendChild(s);
  }

  await waitEvent('YaNddWidgetLoad');

  if (!window.YaDelivery?.createWidget) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (!window.YaDelivery?.createWidget) {
    throw new Error('YA_NDD_WIDGET_NOT_READY');
  }
}

export async function ensureYaNddWidgetLoaded(): Promise<void> {
  if (window.YaDelivery?.createWidget) return;

  if (!loadPromise) {
    loadPromise = loadWidgetScript().catch((error) => {
      loadPromise = null;
      throw error;
    });
  }

  await loadPromise;
}
