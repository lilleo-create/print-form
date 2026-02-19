import React from 'react';
import ReactDOM from 'react-dom';

type YMapComponentProps = Record<string, unknown>;

type Ymaps3Global = {
  ready: Promise<void>;
  import: (pkg: string) => Promise<{
    reactify: {
      bindTo: (
        react: typeof React,
        reactDom: typeof ReactDOM
      ) => {
        module: (ymaps: Ymaps3Global) => {
          YMap: React.ComponentType<YMapComponentProps>;
          YMapDefaultSchemeLayer: React.ComponentType<YMapComponentProps>;
          YMapDefaultFeaturesLayer: React.ComponentType<YMapComponentProps>;
          YMapMarker: React.ComponentType<YMapComponentProps>;
        };
        useDefault: <T>(value: T, deps: unknown[]) => T;
      };
    };
  }>;
};

export type YmapsReactUi = {
  reactify: {
    useDefault: <T>(value: T, deps: unknown[]) => T;
  };
  YMap: React.ComponentType<YMapComponentProps>;
  YMapDefaultSchemeLayer: React.ComponentType<YMapComponentProps>;
  YMapDefaultFeaturesLayer: React.ComponentType<YMapComponentProps>;
  YMapMarker: React.ComponentType<YMapComponentProps>;
};

declare global {
  interface Window {
    ymaps3?: Ymaps3Global;
  }
}

let loading: Promise<YmapsReactUi> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function getYmaps() {
  if (loading) {
    return loading;
  }

  loading = (async () => {
    const key = import.meta.env.VITE_YMAPS_API_KEY;
    if (!key) {
      throw new Error('YMAPS_KEY_MISSING');
    }

    const src = `https://api-maps.yandex.ru/v3/?apikey=${key}&lang=ru_RU`;
    await loadScript(src);

    if (!window.ymaps3) {
      throw new Error('YMAPS_GLOBAL_MISSING');
    }

    await window.ymaps3.ready;

    const ymaps3Reactify = await window.ymaps3.import('@yandex/ymaps3-reactify');
    const reactify = ymaps3Reactify.reactify.bindTo(React, ReactDOM);

    const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } =
      reactify.module(window.ymaps3);

    return {
      reactify,
      YMap,
      YMapDefaultSchemeLayer,
      YMapDefaultFeaturesLayer,
      YMapMarker
    };
  })();

  return loading;
}
