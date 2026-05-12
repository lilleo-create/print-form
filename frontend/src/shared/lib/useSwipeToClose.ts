import { useRef } from 'react';

export const useSwipeToClose = (onClose: () => void) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDelta = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragDelta.current = 0;
    if (panelRef.current) panelRef.current.style.transition = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta < 0) return;
    dragDelta.current = delta;
    if (panelRef.current) panelRef.current.style.transform = `translateY(${delta}px)`;
  };

  const handleTouchEnd = () => {
    dragStartY.current = null;
    if (!panelRef.current) return;
    panelRef.current.style.transition = '';
    panelRef.current.style.transform = '';
    if (dragDelta.current > 80) {
      onClose();
    }
    dragDelta.current = 0;
  };

  return { panelRef, handleTouchStart, handleTouchMove, handleTouchEnd };
};
