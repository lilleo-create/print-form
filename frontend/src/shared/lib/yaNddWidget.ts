const SRC = 'https://ndd-widget.landpro.site/widget.js';
const SCRIPT_ID = 'ya-ndd-widget';
const isDev = import.meta.env.DEV;

const debugLog = (...args: unknown[]) => {
  if (isDev) {
    console.debug('[yaNddWidget]', ...args);
  }
};

declare global {
  interface Window {
    YaDelivery?: {
      createWidget: (config: {
        containerId: string;
        params: Record<string, unknown>;
      }) => void;
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
  if (window.YaDelivery?.createWidget) {
    debugLog('script already available on window');
    return;
  }

  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SRC;
    script.async = true;
    document.head.appendChild(script);
    debugLog('script appended', SRC);
  } else {
    debugLog('existing script tag found');
  }

  await waitEvent('YaNddWidgetLoad');
  debugLog('YaNddWidgetLoad received');

  if (!window.YaDelivery?.createWidget) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (!window.YaDelivery?.createWidget) {
    throw new Error('YA_NDD_WIDGET_NOT_READY');
  }
}

export async function ensureYaNddWidgetLoaded(): Promise<void> {
  if (window.YaDelivery?.createWidget) {
    debugLog('window.YaDelivery is ready');
    return;
  }

  if (!loadPromise) {
    loadPromise = loadWidgetScript().catch((error) => {
      loadPromise = null;
      throw error;
    });
  }

  await loadPromise;
}
