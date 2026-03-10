import { useEffect } from 'react';

export const useModalFocus = (
  isOpen: boolean,
  onClose: () => void,
  container: React.RefObject<HTMLElement>
) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

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
      previousActive?.focus();
    };
  }, [isOpen, onClose, container]);
};
