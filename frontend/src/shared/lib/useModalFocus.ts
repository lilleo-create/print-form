import { useEffect } from 'react';

let modalLockCount = 0;
let originalOverflow = '';
let originalPaddingRight = '';

const lockBodyScroll = () => {
  if (typeof document === 'undefined') return;

  if (modalLockCount === 0) {
    originalOverflow = document.body.style.overflow;
    originalPaddingRight = document.body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  modalLockCount += 1;
};

const unlockBodyScroll = () => {
  if (typeof document === 'undefined' || modalLockCount === 0) return;

  modalLockCount -= 1;

  if (modalLockCount === 0) {
    document.body.style.overflow = originalOverflow;
    document.body.style.paddingRight = originalPaddingRight;
  }
};

export const useModalFocus = (
  isOpen: boolean,
  onClose: () => void,
  container: React.RefObject<HTMLElement>
) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    lockBodyScroll();

    const previousActive = document.activeElement as HTMLElement | null;
    const focusables = container.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables?.[0];
    const last = focusables?.[focusables.length - 1];

    first?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'Tab' && focusables && focusables.length > 0) {
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
      unlockBodyScroll();
      previousActive?.focus();
    };
  }, [isOpen, onClose, container]);
};
