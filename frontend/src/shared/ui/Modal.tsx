import { HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import styles from './Modal.module.css';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import { useOverlayClose } from '../lib/useOverlayClose';

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose?: () => void;
}

export const Modal = ({ isOpen, onClose, className, children, ...props }: ModalProps) => {
  useBodyScrollLock(isOpen);
  const { handlePointerDown, handleClick } = useOverlayClose(onClose);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onPointerDown={handlePointerDown} onClick={handleClick}>
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
