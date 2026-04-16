import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import App from './App';
import 'leaflet/dist/leaflet.css';
import './shared/styles/theme.css';
import './styles/global.css';
import './styles/fonts.css';

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
}

const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;

if (savedTheme) {
  applyTheme(savedTheme);
} else {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const saved = localStorage.getItem('theme');
  if (saved) return;
  applyTheme(e.matches ? 'dark' : 'light');
});

const queryClient = new QueryClient();

const enforceLazyLoadingForImages = () => {
  const patchImage = (image: HTMLImageElement) => {
    if (!image.getAttribute('loading')) {
      image.setAttribute('loading', 'lazy');
    }
    if (!image.getAttribute('decoding')) {
      image.setAttribute('decoding', 'async');
    }
  };

  document.querySelectorAll('img').forEach((node) => patchImage(node as HTMLImageElement));

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;

        if (node.tagName === 'IMG') {
          patchImage(node as HTMLImageElement);
          return;
        }

        node.querySelectorAll('img').forEach((img) => patchImage(img as HTMLImageElement));
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
};

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

enforceLazyLoadingForImages();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HelmetProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
