import { useEffect } from 'react';
import { lockBodyScroll, unlockBodyScroll } from './bodyScrollLockManager';

export const useBodyScrollLock = (isLocked: boolean) => {
  useEffect(() => {
    if (!isLocked) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isLocked]);
};
