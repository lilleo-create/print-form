import { useEffect, useState } from 'react';
import { ChatMessage, ChatThread, ReturnStatus } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { MessageComposer } from '../chats/MessageComposer';
import styles from './AdminChatDetailsPanel.module.css';

interface AdminChatDetailsPanelProps {
  thread: ChatThread | null;
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void> | void;
  onUpdateReturnStatus: (status: ReturnStatus, comment?: string) => Promise<void> | void;
  onUpdateThreadStatus: (status: 'ACTIVE' | 'CLOSED') => Promise<void> | void;
}

const reasonLabels: Record<string, string> = {
  NOT_FIT: 'Не подошло',
  DAMAGED: 'Брак или повреждение',
  WRONG_ITEM: 'Привезли не то'
};

export const AdminChatDetailsPanel = ({
  thread,
  messages,
  onSend,
  onUpdateReturnStatus,
  onUpdateThreadStatus
}: AdminChatDetailsPanelProps) => {
  const [status, setStatus] = useState<ReturnStatus>('CREATED');
  const [adminComment, setAdminComment] = useState('');

  useEffect(() => {
    if (thread?.returnRequest?.status) {
      setStatus(thread.returnRequest.status);
    }
    setAdminComment(thread?.returnRequest?.adminComment ?? '');
  }, [thread]);

  if (!thread) {
    return <div className={styles.empty}>Выберите чат.</div>;
  }

  const returnRequest = thread.returnRequest;
  const returnItem = returnRequest?.items?.[0]?.orderItem ?? null;
  const product = returnItem?.product ?? null;

  const handleUpdateReturn = () => {
    if (!returnRequest) return;
    onUpdateReturnStatus(status, adminComment.trim() || undefined);
  };

  return (
    <div className={styles.panel}>
      {returnRequest && (
        <div className={styles.returnPanel}>
          <strong>Заявка на возврат</strong>
          <p>Причина: {reasonLabels[returnRequest.reason] ?? returnRequest.reason}</p>
          {returnRequest.comment && <p>Комментарий: {returnRequest.comment}</p>}
          <p>Статус: {returnRequest.status}</p>
          <p>
            Дата:{' '}
            {new Date(returnRequest.createdAt).toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })}
          </p>
          {returnRequest.photos?.length > 0 && (
            <div className={styles.photos}>
              {returnRequest.photos.map((photo) => (
                <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                  <img src={photo.url} alt="Фото возврата" />
                </a>
              ))}
            </div>
          )}
          {product && (
            <div className={styles.returnProduct}>
              <img src={product.image} alt={product.title} />
              <div>
                <strong>{product.title}</strong>
                <p>{product.price.toLocaleString('ru-RU')} ₽</p>
              </div>
            </div>
          )}
          <div className={styles.controls}>
            <label>
              Статус возврата
              <select value={status} onChange={(event) => setStatus(event.target.value as ReturnStatus)}>
                <option value="CREATED">CREATED</option>
                <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="REFUNDED">REFUNDED</option>
              </select>
            </label>
            <textarea
              placeholder="Комментарий модератора"
              value={adminComment}
              onChange={(event) => setAdminComment(event.target.value)}
            />
            <Button type="button" onClick={handleUpdateReturn}>
              Обновить возврат
            </Button>
          </div>
        </div>
      )}

      <div className={styles.chatControls}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onUpdateThreadStatus(thread.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE')}
        >
          {thread.status === 'ACTIVE' ? 'Закрыть чат' : 'Открыть чат'}
        </Button>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && <p className={styles.empty}>Нет сообщений.</p>}
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.authorRole === 'ADMIN' ? styles.messageAdmin : styles.messageUser}
          >
            <p>{message.text}</p>
            <span>
              {new Date(message.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>

      <MessageComposer onSend={onSend} disabled={thread.status === 'CLOSED'} />
    </div>
  );
};
