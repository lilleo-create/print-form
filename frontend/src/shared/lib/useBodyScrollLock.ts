import { useEffect } from 'react';

let lockCount = 0;
let prevHtmlOverflow = '';
let prevBodyOverflow = '';
let prevBodyPosition = '';
let prevBodyTop = '';
let prevBodyLeft = '';
let prevBodyRight = '';
let prevBodyWidth = '';
let prevBodyPaddingRight = '';
let scrollY = 0;

const lockScroll = () => {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    scrollY = window.scrollY;

    prevHtmlOverflow = document.documentElement.style.overflow;
    prevBodyOverflow = document.body.style.overflow;
    prevBodyPosition = document.body.style.position;
    prevBodyTop = document.body.style.top;
    prevBodyLeft = document.body.style.left;
    prevBodyRight = document.body.style.right;
    prevBodyWidth = document.body.style.width;
    prevBodyPaddingRight = document.body.style.paddingRight;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  lockCount += 1;
};

const unlockScroll = () => {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.documentElement.style.overflow = prevHtmlOverflow;
    document.body.style.overflow = prevBodyOverflow;
    document.body.style.position = prevBodyPosition;
    document.body.style.top = prevBodyTop;
    document.body.style.left = prevBodyLeft;
    document.body.style.right = prevBodyRight;
    document.body.style.width = prevBodyWidth;
    document.body.style.paddingRight = prevBodyPaddingRight;
    window.scrollTo(0, scrollY);
  }
};

export const useBodyScrollLock = (isLocked: boolean) => {
  useEffect(() => {
    if (!isLocked) return;
    lockScroll();
    return () => unlockScroll();
  }, [isLocked]);
};
