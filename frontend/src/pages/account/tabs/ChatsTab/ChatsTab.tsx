import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatThread, Order } from '../../../../shared/types';
import { resolveImageUrl } from '../../../../shared/lib/resolveImageUrl';
import { getHumanOrderStatus, getOrderSteps } from '../../../../shared/lib/orderPresentation';
import { ChatThreadList } from '../../../../components/chats/ChatThreadList';
import { ChatWindow } from '../../../../components/chats/ChatWindow';
import { MessageComposer } from '../../../../components/chats/MessageComposer';
import type { ChatSendPayload } from '../../../../shared/api/api';
import { ORDER_SUPPORT_TOPIC, SUPPORT_QUESTIONS, SUPPORT_TOPICS, quickQuestionText, type SupportTopic } from '../../../../components/chats/supportTopics';
import styles from './ChatsTab.module.css';

interface ChatsTabProps {
  initialDraft?: string | null;
  recentOrders: Order[];
  chatThreads: { active: ChatThread[]; closed: ChatThread[] };
  selectedThread: ChatThread | null;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  chatError: string | null;
  creatingSupportThread: boolean;
  onSelectThread: (thread: ChatThread) => void;
  onShowSupportStart: () => void;
  onSendMessage: (payload: ChatSendPayload) => Promise<boolean | void> | boolean | void;
  onSubmitSupportQuestion: (topic: string, payload: ChatSendPayload) => Promise<boolean>;
  onSubmitQuickQuestion: (topic: string, text: string) => Promise<boolean>;
}

type FlowStep = 'ROOT' | 'ORDER' | 'CATEGORY';

const OrderShortcut = ({ order, onClick }: { order: Order; onClick?: () => void }) => {
  const item = order.items[0];
  const image = resolveImageUrl(item?.image);
  const content = <>
    {image ? <img src={image} alt="" /> : <span className={styles.quickPlaceholder} aria-hidden="true">▧</span>}
    <span className={styles.quickText}><strong>{order.publicNumber || order.id}</strong><small>{item?.title || 'Товары в заказе'}</small><small>{getHumanOrderStatus(order)}</small></span>
    {onClick && <span className={styles.quickArrow} aria-hidden="true">›</span>}
  </>;
  return onClick
    ? <button type="button" className={styles.quickOrder} onClick={onClick}>{content}</button>
    : <div className={styles.quickOrderStatic}>{content}</div>;
};

const orderQuestions = (order: Order) => {
  const delivered = getOrderSteps(order, 'buyer').some(step => step.key === 'delivered' && step.complete);
  const number = order.publicNumber || order.id;
  return [
    { label: 'Где мой заказ?', text: `Где сейчас находится заказ ${number}?` },
    ...(!delivered ? [{ label: 'Когда придёт?', text: `Когда придёт заказ ${number}?` }] : []),
    { label: 'Пункт выдачи', text: `Хочу уточнить пункт выдачи заказа ${number}.` },
    { label: 'Проблема с товаром', text: `Возникла проблема с товаром в заказе ${number}.` },
    ...(!delivered ? [{ label: 'Хочу отменить заказ', text: `Хочу отменить заказ ${number}.` }] : []),
    { label: 'Другой вопрос по заказу', text: null }
  ];
};

export const ChatsTab = ({ initialDraft, recentOrders, chatThreads, selectedThread, chatMessages, chatLoading, chatError, creatingSupportThread, onSelectThread, onShowSupportStart, onSendMessage, onSubmitSupportQuestion, onSubmitQuickQuestion }: ChatsTabProps) => {
  const [showMobileChat, setShowMobileChat] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [step, setStep] = useState<FlowStep>('ROOT');
  const [order, setOrder] = useState<Order | null>(null);
  const [category, setCategory] = useState<SupportTopic | null>(null);
  const [draft, setDraft] = useState('');
  const [draftEdited, setDraftEdited] = useState(false);
  const [focusVersion, setFocusVersion] = useState(0);
  const [quickBusy, setQuickBusy] = useState(false);
  const quickInFlight = useRef(false);

  useEffect(() => {
    if (!initialDraft) return;
    setDraft(initialDraft);
    setDraftEdited(false);
    setFocusVersion(version => version + 1);
  }, [initialDraft]);

  useEffect(() => { if (selectedThread) setShowMobileChat(true); }, [selectedThread?.id]);

  const resetFlow = () => {
    setStep('ROOT');
    setOrder(null);
    setCategory(null);
    setDraft('');
    setDraftEdited(false);
  };
  const showStart = () => {
    setArchiveOpen(false);
    resetFlow();
    onShowSupportStart();
    setShowMobileChat(true);
  };
  const selectThread = (thread: ChatThread) => {
    resetFlow();
    onSelectThread(thread);
    setShowMobileChat(true);
  };
  const chooseOrder = (nextOrder: Order) => {
    setOrder(nextOrder);
    setCategory(null);
    setStep('ORDER');
  };
  const focusComposer = (nextDraft: string) => {
    const preserveDraft = draftEdited && Boolean(draft.trim());
    setDraft(preserveDraft ? draft : nextDraft);
    setDraftEdited(preserveDraft);
    setFocusVersion(version => version + 1);
  };
  const chooseCategory = (nextCategory: SupportTopic) => {
    setOrder(null);
    setCategory(nextCategory);
    if (nextCategory.label === 'Другой вопрос') {
      setStep('ROOT');
      focusComposer('');
    } else {
      setStep('CATEGORY');
    }
  };
  const changeContext = () => {
    setStep('ROOT');
    setOrder(null);
    setCategory(null);
  };
  const submitQuestion = async (payload: ChatSendPayload) => {
    const topic = order ? ORDER_SUPPORT_TOPIC : category?.value ?? 'Произвольный вопрос';
    const sent = await onSubmitSupportQuestion(topic, payload);
    if (sent) resetFlow();
    return sent;
  };
  const submitQuick = async (topic: string, text: string) => {
    if (quickInFlight.current || creatingSupportThread) return;
    quickInFlight.current = true;
    setQuickBusy(true);
    try {
      const sent = await onSubmitQuickQuestion(topic, text);
      if (sent) resetFlow();
    } finally {
      quickInFlight.current = false;
      setQuickBusy(false);
    }
  };
  const orderNumber = order?.publicNumber || order?.id;
  const prompt = step === 'ROOT' ? 'Здравствуйте! С чем помочь?'
    : step === 'ORDER' ? `Что хотите уточнить по заказу ${orderNumber}?`
      : SUPPORT_QUESTIONS[category?.label ?? '']?.prompt;
  const showThread = selectedThread && (!archiveOpen || selectedThread.status === 'CLOSED');
  const ordinarySupport = chatThreads.active.find(item => item.kind === 'SUPPORT' && !item.returnRequestId && !item.returnRequest);
  const otherActiveThreads = chatThreads.active.filter(item => item.id !== ordinarySupport?.id);
  const backArchive = () => {
    setArchiveOpen(false);
    setShowMobileChat(false);
    if (selectedThread?.status === 'CLOSED') onShowSupportStart();
  };

  return <div className={styles.workspace}>
    <header className={styles.workspaceHeader}>
      {archiveOpen && <button type="button" className={styles.archiveBack} aria-label="Вернуться к чатам" onClick={backArchive}>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>}
      <h1>{archiveOpen ? 'Архив' : 'Чаты'}</h1>
    </header>
    <div className={styles.chatLayout}>
      <aside className={`${styles.chatList} ${showMobileChat ? styles.chatListHidden : ''}`} aria-label="Список чатов">
        {archiveOpen ? <>
          <div className={styles.threadLists}>
            {chatThreads.closed.length
              ? <ChatThreadList threads={chatThreads.closed} activeId={selectedThread?.id} onSelect={selectThread} showEmpty={false} />
              : <p className={styles.archiveEmpty}>В архиве пока ничего нет</p>}
          </div>
        </> : <>
          <button type="button" className={`${styles.supportEntry} ${selectedThread?.id === ordinarySupport?.id && ordinarySupport ? styles.supportEntryActive : ''}`} aria-pressed={Boolean(selectedThread?.id === ordinarySupport?.id && ordinarySupport)} onClick={showStart}>
            <span className={styles.supportAvatar} aria-hidden="true">PF</span>
            <span><strong>Поддержка Print-Form</strong><small>Поможем с заказом, доставкой и оплатой</small></span>
            <span aria-hidden="true">›</span>
          </button>
          <div className={styles.threadLists}>
            <ChatThreadList threads={otherActiveThreads} activeId={selectedThread?.id} onSelect={selectThread} showEmpty={false} />
            <button type="button" className={styles.archiveLink} onClick={() => {
              setArchiveOpen(true);
              setShowMobileChat(false);
            }}>Показать архив <span aria-hidden="true">›</span></button>
          </div>
        </>}
      </aside>
      <div className={`${styles.chatWindowPane} ${showMobileChat ? styles.chatWindowActive : ''}`}>
        {showThread ? <ChatWindow thread={selectedThread} messages={chatMessages} loading={chatLoading} error={chatError} onSend={onSendMessage} onBack={() => setShowMobileChat(false)} draft={selectedThread.kind === 'SUPPORT' && !selectedThread.returnRequestId ? draft : undefined} focusKey={focusVersion} />
          : archiveOpen ? <div className={styles.archivePrompt}>Выберите диалог из архива</div>
          : <div className={styles.flowPane}>
            <header className={styles.flowHeader}>
              <button type="button" className={styles.mobileBack} onClick={() => setShowMobileChat(false)} aria-label="К списку чатов">←</button>
              <span className={styles.supportAvatar} aria-hidden="true">PF</span>
              <strong>Чат с поддержкой</strong>
            </header>
            <div className={styles.flowContent}>
              <div className={styles.flowInner}>
              <div className={styles.botMessage}><span className={styles.botAvatar} aria-hidden="true">PF</span><div className={styles.botGroup}><span>Поддержка Print-Form</span><p>{prompt}</p></div></div>
              {step === 'ROOT' && <>
                {recentOrders.length > 0 && <section className={styles.quickSection} aria-label="Последние заказы">
                  <h2>Последние заказы</h2>
                  <div className={styles.quickOrders}>{recentOrders.slice(0, 2).map(item => <OrderShortcut key={item.id} order={item} onClick={() => chooseOrder(item)} />)}</div>
                </section>}
                <section className={styles.quickSection} aria-label="Другой вопрос">
                  <h2>Другой вопрос</h2>
                  <div className={styles.topicChips}>{SUPPORT_TOPICS.map(item => <button key={item.label} type="button" onClick={() => chooseCategory(item)}>{item.label}</button>)}</div>
                </section>
              </>}
              {step === 'ORDER' && order && <>
                <OrderShortcut order={order} />
                <div className={styles.flowOptions}>
                  {orderQuestions(order).map(item => <button key={item.label} type="button" disabled={quickBusy || creatingSupportThread} onClick={() => item.text ? void submitQuick(ORDER_SUPPORT_TOPIC, item.text) : focusComposer(`Заказ ${orderNumber}. `)}>{item.label}</button>)}
                  <button type="button" disabled={quickBusy || creatingSupportThread} onClick={changeContext}>Другой заказ / тема</button>
                </div>
              </>}
              {step === 'CATEGORY' && category && <div className={styles.flowOptions}>
                {SUPPORT_QUESTIONS[category.label].options.map(item => <button key={item.label} type="button" disabled={quickBusy || creatingSupportThread} onClick={() => item.label === 'Другой вопрос' ? focusComposer('') : void submitQuick(category.value, quickQuestionText(item.draft))}>{item.label}</button>)}
                <button type="button" disabled={quickBusy || creatingSupportThread} onClick={changeContext}>Изменить тему</button>
              </div>}
              {chatError && <p className={styles.startError} role="alert">{chatError}</p>}
              </div>
            </div>
            <div className={styles.flowComposer}><MessageComposer onSend={submitQuestion} draft={draft} focusKey={focusVersion} onValueChange={value => {
              setDraft(value);
              setDraftEdited(true);
            }} disabled={creatingSupportThread || quickBusy} placeholder="Напишите ваш вопрос..." /></div>
          </div>}
      </div>
    </div>
  </div>;
};
