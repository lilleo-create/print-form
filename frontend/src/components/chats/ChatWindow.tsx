import { useEffect, useRef } from 'react';
import { ChatMessage, ChatThread } from '../../shared/types';
import { MessageComposer } from './MessageComposer';
import styles from './ChatWindow.module.css';
import { resolveMediaUrl } from '../../shared/lib/resolveMediaUrl';
import { getProductMainImage } from '../../shared/lib/productMedia';
import { formatPrice } from '../../utils/money';

interface ChatWindowProps {
  thread: ChatThread | null;
  messages: ChatMessage[];
  loading: boolean;
  error?: string | null;
  onSend: (text: string) => Promise<void> | void;
  onBack?: () => void;
}

const reasonLabels: Record<string, string> = {
  NOT_FIT: 'Не подошло',
  DAMAGED: 'Брак или повреждение',
  WRONG_ITEM: 'Привезли не то'
};

const getThreadSubtitle = (thread: ChatThread) => {
  if (thread.returnRequest) return 'Чат по заявке на возврат';
  if (thread.kind === 'SELLER') {
    return thread.sellerShopName
      ? `Диалог с магазином «${thread.sellerShopName}»`
      : 'Диалог с продавцом';
  }
  return thread.supportTopic ? `Тема: ${thread.supportTopic}` : 'Обращение в поддержку';
};

export const ChatWindow = ({ thread, messages, loading, error, onSend, onBack }: ChatWindowProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!thread) {
    return (
      <div className={styles.emptyPane}>
        <div className={styles.emptyIcon}>
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.5" opacity=".25"/>
            <path d="M14 18h20M14 24h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M28 34l6-6H14a2 2 0 01-2-2V16a2 2 0 012-2h20a2 2 0 012 2v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className={styles.emptyText}>Выберите чат</p>
        <p className={styles.emptyHint}>Выберите диалог из списка, чтобы начать общение</p>
      </div>
    );
  }

  const returnItem = thread.returnRequest?.items?.[0]?.orderItem ?? null;
  const product = returnItem?.product ?? null;
  const productImage = getProductMainImage(product ?? undefined);

  return (
    <div className={styles.window}>
      {/* Header */}
      <div className={styles.threadHeader}>
        {onBack && (
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Назад">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M13 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <div className={styles.threadHeaderText}>
          <strong>{thread.kind === 'SELLER' ? 'Чат с продавцом' : 'Чат поддержки'}</strong>
          <p>{getThreadSubtitle(thread)}</p>
        </div>
        {thread.status === 'CLOSED' && (
          <span className={styles.closedBadge}>Закрыт</span>
        )}
      </div>

      {/* Return panel */}
      {thread.returnRequest && (
        <div className={styles.returnPanel}>
          <strong>Заявка на возврат</strong>
          <p>
            Причина:{' '}
            {reasonLabels[thread.returnRequest.reason] ?? thread.returnRequest.reason}
          </p>
          {thread.returnRequest.comment && (
            <p>Комментарий: {thread.returnRequest.comment}</p>
          )}
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
                <a key={photo.id} href={resolveMediaUrl(photo.url) ?? '#'} target="_blank" rel="noreferrer">
                  <img src={resolveMediaUrl(photo.url) ?? ''} alt="Фото возврата" />
                </a>
              ))}
            </div>
          )}
          {product && (
            <div className={styles.returnProduct}>
              {productImage ? (
                <img src={productImage} alt={product.title} />
              ) : (
                <div aria-hidden="true" />
              )}
              <div>
                <strong>{product.title}</strong>
                <p>{formatPrice(product.price)} ₽</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className={styles.messages}>
        {loading && <p className={styles.statusMsg}>Загрузка сообщений...</p>}
        {error && <p className={styles.statusMsg}>{error}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className={styles.statusMsg}>Нет сообщений.</p>
        )}
        {messages.map((message, i) => {
          const isUser = message.authorRole === 'USER';
          const prevSame = i > 0 && messages[i - 1].authorRole === message.authorRole;
          return (
            <div
              key={message.id}
              className={`${isUser ? styles.messageUser : styles.messageAdmin} ${prevSame ? styles.messageContinued : ''}`}
            >
              {!prevSame && (
                <span className={styles.senderLabel}>
                  {isUser ? 'Вы' : 'Поддержка'}
                </span>
              )}
              <div className={styles.bubble}>
                <p>{message.text}</p>
                <span className={styles.time}>
                  {new Date(message.createdAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className={styles.composerWrap}>
        {thread.status === 'CLOSED' ? (
          <p className={styles.closedNote}>Диалог закрыт. Отправка сообщений недоступна.</p>
        ) : (
          <MessageComposer onSend={onSend} />
        )}
      </div>
    </div>
  );
};
