import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState } from 'react';
import styles from './SellerProductModal.module.css';

type Position = { top: number; left: number };

export const RequiredMark = () => {
  const markRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });

  useEffect(() => {
    if (!visible) return;
    const updatePosition = () => {
      const rect = markRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: Math.max(30, rect.top - 6),
        left: Math.min(window.innerWidth - 82, Math.max(82, rect.left + rect.width / 2))
      });
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [visible]);

  return <>
    <span ref={markRef} className={styles.requiredMark} role="img" tabIndex={0}
      aria-label="Обязательное поле" aria-describedby={visible ? tooltipId : undefined}
      onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)} onBlur={() => setVisible(false)}>*</span>
    {visible && createPortal(
      <span id={tooltipId} role="tooltip" className={styles.requiredTooltip}
        style={{ top: position.top, left: position.left }}>Обязательное поле</span>,
      document.body
    )}
  </>;
};
