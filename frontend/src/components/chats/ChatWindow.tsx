import { Fragment, useEffect, useRef, useState } from 'react';
import { ChatMessage, ChatThread } from '../../shared/types';
import { MessageComposer } from './MessageComposer';
import styles from './ChatWindow.module.css';
import { resolveMediaUrl } from '../../shared/lib/resolveMediaUrl';
import { getProductMainImage } from '../../shared/lib/productMedia';
import { formatPrice } from '../../utils/money';
import { getReturnStatusLabel } from '../../shared/lib/adminStatusLabels';

interface ChatWindowProps {
  thread: ChatThread | null;
  messages: ChatMessage[];
  loading: boolean;
  error?: string | null;
  onSend: (text: string) => Promise<void> | void;
  onBack?: () => void;
}

const reasonLabels: Record<string, string> = {
  NOT_FIT:    'Не подошло',
  DAMAGED:    'Брак или повреждение',
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

const getDateKey = (dateStr: string) => new Date(dateStr).toDateString();

const getDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== today.getFullYear() && { year: 'numeric' })
  });
};

export const ChatWindow = ({ thread, messages, loading, error, onSend, onBack }: ChatWindowProps) => {
  const messagesRef = useRef<HTMLDivElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Scroll the messages container itself — never the outer page
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    setDetailsOpen(false);
  }, [thread?.id]);

  // Show loading only on initial load (no messages yet) to prevent list jumps
  const showLoader = loading && messages.length === 0;

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
  const rr = thread.returnRequest;
  const returnStatusLabel = rr ? getReturnStatusLabel(rr.status, rr.statusLabelRu) : null;

  return (
    <div className={styles.window}>
      {/* Header */}
      <div className={styles.threadHeader}>
        {onBack && (
          <button
            type="button"
            className={styles.backBtn}
            onClick={onBack}
            aria-label="Назад"
          >
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

      {/* Compact return card */}
      {rr && (
        <button
          type="button"
          className={styles.returnCard}
          onClick={() => setDetailsOpen(true)}
        >
          {product && productImage && (
            <img className={styles.returnCardImg} src={productImage} alt={product.title} />
          )}
          <div className={styles.returnCardBody}>
            <span className={styles.returnCardTitle}>Заявка на возврат</span>
            <span className={styles.returnCardSub}>{reasonLabels[rr.reason] ?? rr.reason}</span>
          </div>
          <span className={styles.returnCardStatus}>{returnStatusLabel}</span>
        </button>
      )}

      {/* Details sheet */}
      {rr && detailsOpen && (
        <div className={styles.detailsOverlay} onClick={() => setDetailsOpen(false)}>
          <div className={styles.detailsSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.detailsHandle} />
            <div className={styles.detailsSheetHeader}>
              <span className={styles.detailsSheetTitle}>Детали возврата</span>
              <button
                type="button"
                className={styles.detailsCloseBtn}
                onClick={() => setDetailsOpen(false)}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>
            <div className={styles.detailsSheetBody}>
              {product && (
                <button
                  type="button"
                  className={styles.returnProduct}
                  onClick={() => setDetailsOpen(false)}
                >
                  {productImage && <img src={productImage} alt={product.title} />}
                  <div>
                    <strong>{product.title}</strong>
                    <p>{formatPrice(product.price)} ₽</p>
                  </div>
                </button>
              )}
              <div className={styles.returnRow}>
                <span className={styles.returnLabel}>Причина:</span>
                <span>{reasonLabels[rr.reason] ?? rr.reason}</span>
              </div>
              {rr.comment && (
                <div className={styles.returnRow}>
                  <span className={styles.returnLabel}>Комментарий:</span>
                  <span>{rr.comment}</span>
                </div>
              )}
              <div className={styles.returnRow}>
                <span className={styles.returnLabel}>Статус:</span>
                <span className={styles.returnStatus}>{returnStatusLabel}</span>
              </div>
              <div className={styles.returnRow}>
                <span className={styles.returnLabel}>Дата:</span>
                <span>
                  {new Date(rr.createdAt).toLocaleDateString('ru-RU', {
                    day: '2-digit', month: 'long', year: 'numeric'
                  })}
                </span>
              </div>
              {rr.photos?.length > 0 && (
                <div className={styles.photos}>
                  {rr.photos.map((photo) => (
                    <a key={photo.id} href={resolveMediaUrl(photo.url) ?? '#'} target="_blank" rel="noreferrer">
                      <img src={resolveMediaUrl(photo.url) ?? ''} alt="Фото возврата" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages — ref here for direct scrollTop control */}
      <div ref={messagesRef} className={styles.messages}>
        {showLoader && <p className={styles.statusMsg}>Загрузка сообщений...</p>}
        {error && <p className={styles.statusMsg}>{error}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className={styles.statusMsg}>Нет сообщений.</p>
        )}
        {messages.map((message, i) => {
          const isUser = message.authorRole === 'USER';
          const showDateSep = i === 0 || getDateKey(messages[i - 1].createdAt) !== getDateKey(message.createdAt);
          const prevSame = i > 0 && messages[i - 1].authorRole === message.authorRole && !showDateSep;
          return (
            <Fragment key={message.id}>
              {showDateSep && (
                <div className={styles.dateSep}>
                  <span>{getDateLabel(message.createdAt)}</span>
                </div>
              )}
              <div className={`${isUser ? styles.messageUser : styles.messageAdmin} ${prevSame ? styles.messageContinued : ''}`}>
                {!prevSame && (
                  <span className={styles.senderLabel}>{isUser ? 'Вы' : 'Поддержка'}</span>
                )}
                <div className={styles.bubble}>
                  <p>{message.text}</p>
                  <span className={styles.time}>
                    {new Date(message.createdAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </Fragment>
          );
        })}
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
