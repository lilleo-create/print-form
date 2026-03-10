import { useEffect } from 'react';

let lockCount = 0;
let prevHtmlOverflow = '';
let prevBodyOverflow = '';

const lockScroll = () => {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    prevHtmlOverflow = document.documentElement.style.overflow;
    prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
};

const unlockScroll = () => {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.documentElement.style.overflow = prevHtmlOverflow;
    document.body.style.overflow = prevBodyOverflow;
  }
};

export const useBodyScrollLock = (isLocked: boolean) => {
  useEffect(() => {
    if (!isLocked) return;
    lockScroll();
    return () => unlockScroll();
  }, [isLocked]);
};
