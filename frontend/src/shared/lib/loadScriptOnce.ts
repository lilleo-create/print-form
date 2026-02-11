const scriptPromises = new Map<string, Promise<void>>();

export const loadScriptOnce = (src: string) => {
  if (scriptPromises.has(src)) {
    return scriptPromises.get(src)!;
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing?.dataset.loaded === 'true') {
    const resolved = Promise.resolve();
    scriptPromises.set(src, resolved);
    return resolved;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement('script');
    script.src = src;
    script.async = true;

    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('NDD_WIDGET_LOAD_FAILED'));

    if (!existing) {
      document.body.appendChild(script);
    }
  });

  scriptPromises.set(src, promise);
  return promise;
};
