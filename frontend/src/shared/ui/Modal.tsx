import { HTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Modal.module.css';

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose?: () => void;
}

export const Modal = ({ isOpen, onClose, className, children, ...props }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={clsx(styles.modal, className)}
        onClick={(event) => event.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
};
