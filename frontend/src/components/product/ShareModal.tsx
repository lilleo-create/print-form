import { useMemo, useRef } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { useModalFocus } from '../../shared/lib/useModalFocus';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import type { Product } from '../../shared/types';
import styles from './ShareModal.module.css';

interface ShareModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
}

export const ShareModal = ({ product, isOpen, onClose, onToast }: ShareModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, onClose, modalRef);

  const shareUrl = useMemo(() => window.location.href, []);
  const title = product.title;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      onToast('Ссылка скопирована');
    } catch {
      onToast('Не удалось скопировать ссылку');
    }
  };

  const handleTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleWhatsapp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${title} ${shareUrl}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className={styles.modal}>
      <div ref={modalRef}>
        <header className={styles.header}>
          <h2>Поделиться</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть окно">
            ✕
          </button>
        </header>
        <div className={styles.product}>
          {product.image ? (
            <img src={resolveImageUrl(product.image)} alt={product.title} />
          ) : (
            <div className={styles.placeholder} aria-hidden="true" />
          )}
          <div className={styles.productInfo}>
            <strong>{product.title}</strong>
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.actionButton} onClick={handleCopy}>
            Копировать ссылку
          </button>
          <button type="button" className={styles.actionButton} onClick={handleTelegram}>
            Телеграм
          </button>
          <button type="button" className={styles.actionButton} onClick={handleWhatsapp}>
            WhatsApp
          </button>
        </div>
      </div>
    </Modal>
  );
};
