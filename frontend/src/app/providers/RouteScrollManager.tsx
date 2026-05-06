import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const SCROLL_ROOT_SELECTOR = '[data-route-scroll-root]';

/* Prevent the browser from auto-restoring scroll on PUSH/REPLACE navigations */
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

const scrollToTop = () => {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  const roots = document.querySelectorAll<HTMLElement>(SCROLL_ROOT_SELECTOR);
  roots.forEach((root) => {
    root.scrollTop = 0;
    root.scrollLeft = 0;
  });
};

export const RouteScrollManager = () => {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    if (location.hash) return;
    scrollToTop();
  }, [location.pathname, location.search, location.hash, navigationType]);

  return null;
};
