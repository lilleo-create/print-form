import { ChatMessage, ChatThread } from '../../shared/types';
import { MessageComposer } from './MessageComposer';
import styles from './ChatWindow.module.css';

interface ChatWindowProps {
  thread: ChatThread | null;
  messages: ChatMessage[];
  loading: boolean;
  error?: string | null;
  onSend: (text: string) => Promise<void> | void;
}

const reasonLabels: Record<string, string> = {
  NOT_FIT: 'Не подошло',
  DAMAGED: 'Брак или повреждение',
  WRONG_ITEM: 'Привезли не то'
};

export const ChatWindow = ({ thread, messages, loading, error, onSend }: ChatWindowProps) => {
  if (!thread) {
    return <div className={styles.empty}>Выберите чат.</div>;
  }

  const returnItem = thread.returnRequest?.items?.[0]?.orderItem ?? null;
  const product = returnItem?.product ?? null;

  return (
    <div className={styles.window}>
      {thread.returnRequest && (
        <div className={styles.returnPanel}>
          <strong>Заявка на возврат</strong>
          <p>Причина: {reasonLabels[thread.returnRequest.reason] ?? thread.returnRequest.reason}</p>
          {thread.returnRequest.comment && <p>Комментарий: {thread.returnRequest.comment}</p>}
          <p>Статус: {thread.returnRequest.status}</p>
          <p>
            Дата:{' '}
            {new Date(thread.returnRequest.createdAt).toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })}
          </p>
          {thread.returnRequest.photos?.length > 0 && (
            <div className={styles.photos}>
              {thread.returnRequest.photos.map((photo) => (
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
        </div>
      )}

      <div className={styles.messages}>
        {loading && <p className={styles.empty}>Загрузка сообщений...</p>}
        {error && <p className={styles.empty}>{error}</p>}
        {!loading && !error && messages.length === 0 && <p className={styles.empty}>Нет сообщений.</p>}
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.authorRole === 'USER' ? styles.messageUser : styles.messageAdmin}
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
