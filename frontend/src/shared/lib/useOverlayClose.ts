import { MouseEvent, PointerEvent, useRef } from 'react';

export const useOverlayClose = (onClose?: () => void) => {
  const pointerDownOnOverlayRef = useRef(false);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerDownOnOverlayRef.current = event.target === event.currentTarget;
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onClose) return;

    const isOverlayTarget = event.target === event.currentTarget;
    if (!isOverlayTarget) return;
    if (!pointerDownOnOverlayRef.current) return;

    pointerDownOnOverlayRef.current = false;
    onClose();
  };

  return {
    handlePointerDown,
    handleClick,
  };
};
