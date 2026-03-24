let lockCount = 0;
let scrollY = 0;
let prevHtmlOverflow = '';
let prevBodyOverflow = '';
let prevBodyPosition = '';
let prevBodyTop = '';
let prevBodyWidth = '';
let prevBodyPaddingRight = '';

const getScrollbarWidth = () => window.innerWidth - document.documentElement.clientWidth;

const applyScrollLock = () => {
  prevHtmlOverflow = document.documentElement.style.overflow;
  prevBodyOverflow = document.body.style.overflow;
  prevBodyPosition = document.body.style.position;
  prevBodyTop = document.body.style.top;
  prevBodyWidth = document.body.style.width;
  prevBodyPaddingRight = document.body.style.paddingRight;

  scrollY = window.scrollY;
  const scrollbarWidth = getScrollbarWidth();

  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
};

const restoreScrollLock = () => {
  document.documentElement.style.overflow = prevHtmlOverflow;
  document.body.style.overflow = prevBodyOverflow;
  document.body.style.position = prevBodyPosition;
  document.body.style.top = prevBodyTop;
  document.body.style.width = prevBodyWidth;
  document.body.style.paddingRight = prevBodyPaddingRight;
  window.scrollTo(0, scrollY);
};

export const lockBodyScroll = () => {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    applyScrollLock();
  }
  lockCount += 1;
};

export const unlockBodyScroll = () => {
  if (typeof document === 'undefined' || lockCount === 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    restoreScrollLock();
  }
};
