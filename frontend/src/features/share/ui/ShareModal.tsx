import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../shared/ui/Modal';
import { resolveImageUrl } from '../../../shared/lib/resolveImageUrl';
import { useModalFocus } from '../../../shared/lib/useModalFocus';
import { buildTelegramShareLink, buildWhatsappShareLink } from '../lib/shareLinks';
import styles from './ShareModal.module.css';

type ShareModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  image?: string | null;
};

export const ShareModal = ({ isOpen, onClose, title, image }: ShareModalProps) => {
  const [toast, setToast] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(isOpen, onClose, modalRef);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const href = typeof window !== 'undefined' ? window.location.href : '';

  const copyLink = async () => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(href);
    setToast('Ссылка скопирована');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} role="dialog" aria-modal="true" aria-label="Поделиться" className={styles.modal}>
      <div ref={modalRef} className={styles.content}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">×</button>
        <div className={styles.header}>
          <img src={resolveImageUrl(image ?? '')} alt={title} className={styles.image} />
          <h3>{title}</h3>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => void copyLink()}>Копировать ссылку</button>
          <a href={buildTelegramShareLink(href, title)} target="_blank" rel="noreferrer">Telegram</a>
          <a href={buildWhatsappShareLink(href, title)} target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
        {toast ? <div className={styles.toast}>{toast}</div> : null}
      </div>
    </Modal>
  );
};
