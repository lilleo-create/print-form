import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModalFocus } from '../../shared/lib/useModalFocus';
import { ReturnRequest } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { Modal } from '../../shared/ui/Modal';
import { ReturnDetails } from './ReturnDetails';
import styles from './ReturnDetailsModal.module.css';

interface ReturnDetailsModalProps {
  request: ReturnRequest | null;
  onClose: () => void;
}

export const ReturnDetailsModal = ({ request, onClose }: ReturnDetailsModalProps) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const isOpen = Boolean(request);
  useModalFocus(isOpen, onClose, containerRef);

  const chatLink = useMemo(() => {
    if (!request?.chatThread?.id) return '/account?tab=chats';
    return `/account?tab=chats&threadId=${request.chatThread.id}`;
  }, [request?.chatThread?.id]);

  if (!request) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className={styles.modal}>
      <div ref={containerRef} className={styles.container} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div>
            <p className={styles.title}>
              Возврат от{' '}
              {new Date(request.createdAt).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </p>
            <span className={styles.subtitle}>№ {request.id}</span>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть окно">
            ✕
          </button>
        </div>
        <ReturnDetails request={request} />
        <div className={styles.footer}>
          <Button type="button" onClick={() => navigate(chatLink)}>
            Перейти в чат
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </Modal>
  );
};
