const YA_NDD_WIDGET_SCRIPT_ID = 'ya-ndd-widget';
const YA_NDD_WIDGET_SCRIPT_SRC = 'https://ndd-widget.landpro.site/widget.js';

declare global {
  interface Window {
    YaDelivery?: {
      createWidget: (params: { containerId: string; params: Record<string, unknown> }) => void;
    };
  }
}

let widgetLoaderPromise: Promise<void> | null = null;

const waitForYaNddWidgetLoad = () =>
  new Promise<void>((resolve) => {
    document.addEventListener('YaNddWidgetLoad', () => resolve(), { once: true });
  });

export const ensureYaNddWidgetLoaded = async (): Promise<void> => {
  if (window.YaDelivery?.createWidget) {
    return;
  }

  if (!widgetLoaderPromise) {
    widgetLoaderPromise = (async () => {
      let script = document.getElementById(YA_NDD_WIDGET_SCRIPT_ID) as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement('script');
        script.id = YA_NDD_WIDGET_SCRIPT_ID;
        script.async = true;
        script.src = YA_NDD_WIDGET_SCRIPT_SRC;
        document.head.append(script);
      }

      if (!window.YaDelivery) {
        await waitForYaNddWidgetLoad();
      }

      if (!window.YaDelivery?.createWidget) {
        throw new Error('YA_NDD_WIDGET_NOT_READY');
      }
    })();
  }

  await widgetLoaderPromise;
};
