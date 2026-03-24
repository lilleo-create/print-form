import { HTMLAttributes, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import styles from './Modal.module.css';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose?: () => void;
}

export const Modal = ({ isOpen, onClose, className, children, ...props }: ModalProps) => {
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onClose) return;
    if (event.target !== event.currentTarget) return;
    onClose();
  };

  return createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        className={clsx(styles.modal, className)}
        onClick={(event) => event.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
