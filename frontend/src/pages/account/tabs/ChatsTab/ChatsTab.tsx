import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChatMessage, ChatThread, Order } from '../../../../shared/types';
import { resolveImageUrl } from '../../../../shared/lib/resolveImageUrl';
import { getHumanOrderStatus } from '../../../../shared/lib/orderPresentation';
import { ChatThreadList } from '../../../../components/chats/ChatThreadList';
import { ChatWindow } from '../../../../components/chats/ChatWindow';
import { ORDER_SUPPORT_TOPIC, SUPPORT_TOPICS } from '../../../../components/chats/supportTopics';
import styles from './ChatsTab.module.css';

interface ChatsTabProps {
  recentOrders: Order[];
  chatThreads: { active: ChatThread[]; closed: ChatThread[] };
  selectedThread: ChatThread | null;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  chatError: string | null;
  creatingSupportThread: boolean;
  onSelectThread: (thread: ChatThread) => void;
  onShowSupportStart: () => void;
  onSendMessage: (text: string) => void;
  onCreateSupportThread: (topic: string) => Promise<ChatThread | null>;
}

type SupportStartProps = {
  orders: Order[];
  busy: boolean;
  error: string | null;
  onOrder: (order: Order) => void;
  onTopic: (topic: string) => void;
};

const SupportStart = ({ orders, busy, error, onOrder, onTopic }: SupportStartProps) => <div className={styles.startScreen}>
  <span className={styles.startMark} aria-hidden="true">PF</span>
  <h2>Чем помочь?</h2>
  <p>Выберите заказ или тему вопроса. Сообщение отправится только после вашего подтверждения.</p>
  {orders.length > 0 && <section className={styles.quickSection} aria-label="Последние заказы">
    <h3>Последние заказы</h3>
    <div className={styles.quickOrders}>{orders.slice(0, 2).map(order => {
      const item = order.items[0];
      const image = resolveImageUrl(item?.image);
      return <button key={order.id} type="button" className={styles.quickOrder} disabled={busy} onClick={() => onOrder(order)}>
        {image ? <img src={image} alt="" /> : <span className={styles.quickPlaceholder} aria-hidden="true">▧</span>}
        <span><strong>Вопрос по заказу {order.publicNumber || order.id}</strong><small>{item?.title || 'Товары в заказе'} · {getHumanOrderStatus(order)}</small></span>
        <span className={styles.quickArrow} aria-hidden="true">›</span>
      </button>;
    })}</div>
  </section>}
  <section className={styles.quickSection} aria-label="Другой вопрос">
    <h3>Другой вопрос</h3>
    <div className={styles.topicChips}>{SUPPORT_TOPICS.map(topic => <button key={topic.label} type="button" disabled={busy} onClick={() => onTopic(topic.value)}>{topic.label}</button>)}</div>
  </section>
  {error && <p className={styles.startError} role="alert">{error}</p>}
</div>;

export const ChatsTab = ({ recentOrders, chatThreads, selectedThread, chatMessages, chatLoading, chatError, creatingSupportThread, onSelectThread, onShowSupportStart, onSendMessage, onCreateSupportThread }: ChatsTabProps) => {
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [draft, setDraft] = useState<{ threadId: string; text: string } | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
  const createInFlight = useRef(false);

  useEffect(() => { if (selectedThread) setShowMobileChat(true); }, [selectedThread?.id]);

  const start = async (topic: string, draftText?: string) => {
    if (creatingSupportThread || createInFlight.current) return;
    createInFlight.current = true;
    try {
      const thread = await onCreateSupportThread(topic);
      if (!thread) return;
      onSelectThread(thread);
      setDraft(draftText ? { threadId: thread.id, text: draftText } : null);
      setFocusVersion(version => version + 1);
      setShowMobileChat(true);
    } finally {
      createInFlight.current = false;
    }
  };

  const selectThread = (thread: ChatThread) => {
    setDraft(null);
    onSelectThread(thread);
    setShowMobileChat(true);
  };

  const showStart = () => { onShowSupportStart(); setDraft(null); setShowMobileChat(false); };
  const startProps: SupportStartProps = {
    orders: recentOrders.slice(0, 2), busy: creatingSupportThread || createInFlight.current, error: chatError,
    onOrder: order => void start(ORDER_SUPPORT_TOPIC, `Вопрос по заказу ${order.publicNumber || order.id}: `),
    onTopic: topic => void start(topic)
  };

  return <div className={styles.workspace}>
    <header className={styles.workspaceHeader}><h1>Чаты</h1><Link to="/account?tab=profile" aria-label="Закрыть чаты">×</Link></header>
    <div className={styles.chatLayout}>
      <aside className={`${styles.chatList} ${showMobileChat ? styles.chatListHidden : ''}`} aria-label="Список чатов">
        <button type="button" className={styles.supportEntry} onClick={showStart}>
          <span className={styles.supportAvatar} aria-hidden="true">PF</span>
          <span><strong>Поддержка Print-Form</strong><small>Поможем с заказом, доставкой, оплатой и работой сервиса</small></span>
          <span aria-hidden="true">›</span>
        </button>
        <div className={styles.mobileStart}><SupportStart {...startProps} /></div>
        <div className={styles.threadLists}>
          <h2>Мои диалоги</h2>
          <ChatThreadList title="Активные" threads={chatThreads.active ?? []} activeId={selectedThread?.id} onSelect={selectThread} />
          <ChatThreadList title="Завершённые" threads={chatThreads.closed ?? []} activeId={selectedThread?.id} onSelect={selectThread} />
        </div>
      </aside>
      <div className={`${styles.chatWindowPane} ${showMobileChat ? styles.chatWindowActive : ''}`}>
        {selectedThread ? <ChatWindow thread={selectedThread} messages={chatMessages} loading={chatLoading} error={chatError} onSend={onSendMessage} onBack={() => setShowMobileChat(false)} draft={draft?.threadId === selectedThread.id ? draft.text : undefined} focusKey={focusVersion} />
          : <div className={styles.desktopStart}><SupportStart {...startProps} /></div>}
      </div>
    </div>
  </div>;
};
