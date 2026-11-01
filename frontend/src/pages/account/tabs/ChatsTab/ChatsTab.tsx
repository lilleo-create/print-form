import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChatMessage, ChatThread, Order } from '../../../../shared/types';
import { resolveImageUrl } from '../../../../shared/lib/resolveImageUrl';
import { getHumanOrderStatus, getOrderSteps } from '../../../../shared/lib/orderPresentation';
import { ChatThreadList } from '../../../../components/chats/ChatThreadList';
import { ChatWindow } from '../../../../components/chats/ChatWindow';
import { MessageComposer } from '../../../../components/chats/MessageComposer';
import { ORDER_SUPPORT_TOPIC, SUPPORT_QUESTIONS, SUPPORT_TOPICS, type SupportTopic } from '../../../../components/chats/supportTopics';
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
  onSubmitSupportQuestion: (topic: string, text: string) => Promise<boolean>;
}

type FlowStep = 'ROOT' | 'ORDER' | 'CATEGORY' | 'COMPOSER';

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
  return [
    { label: 'Где мой заказ?', draft: 'Хочу узнать, где сейчас мой заказ. ' },
    ...(!delivered ? [{ label: 'Когда придёт?', draft: 'Хочу уточнить срок доставки: ' }] : []),
    { label: 'Проблема с получением / ПВЗ', draft: 'Возникла проблема с получением заказа или ПВЗ. ' },
    ...(!delivered ? [{ label: 'Хочу отменить заказ', draft: 'Хочу уточнить отмену заказа. ' }] : []),
    { label: 'Проблема с товаром', draft: 'Возникла проблема с товаром. ' },
    { label: 'Другой вопрос по заказу', draft: '' }
  ];
};

export const ChatsTab = ({ recentOrders, chatThreads, selectedThread, chatMessages, chatLoading, chatError, creatingSupportThread, onSelectThread, onShowSupportStart, onSendMessage, onSubmitSupportQuestion }: ChatsTabProps) => {
  const [showMobileChat, setShowMobileChat] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [step, setStep] = useState<FlowStep>('ROOT');
  const [order, setOrder] = useState<Order | null>(null);
  const [category, setCategory] = useState<SupportTopic | null>(null);
  const [draft, setDraft] = useState('');
  const [focusVersion, setFocusVersion] = useState(0);

  useEffect(() => { if (selectedThread) setShowMobileChat(true); }, [selectedThread?.id]);

  const resetFlow = () => {
    setStep('ROOT');
    setOrder(null);
    setCategory(null);
    setDraft('');
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
  const openComposer = (nextDraft: string) => {
    setDraft(nextDraft);
    setStep('COMPOSER');
    setFocusVersion(version => version + 1);
  };
  const chooseCategory = (nextCategory: SupportTopic) => {
    setOrder(null);
    setCategory(nextCategory);
    if (nextCategory.label === 'Другой вопрос') openComposer('');
    else setStep('CATEGORY');
  };
  const back = () => {
    if (step === 'COMPOSER') setStep(order ? 'ORDER' : category?.label === 'Другой вопрос' ? 'ROOT' : 'CATEGORY');
    else resetFlow();
  };
  const submitQuestion = async (text: string) => {
    const topic = order ? ORDER_SUPPORT_TOPIC : category?.value ?? 'Произвольный вопрос';
    const sent = await onSubmitSupportQuestion(topic, text);
    if (sent) resetFlow();
    return sent;
  };
  const orderNumber = order?.publicNumber || order?.id;
  const prompt = step === 'ROOT' ? 'Здравствуйте! С чем помочь?'
    : step === 'ORDER' ? `Что хотите уточнить по заказу ${orderNumber}?`
      : step === 'CATEGORY' ? SUPPORT_QUESTIONS[category?.label ?? '']?.prompt
        : 'Опишите ваш вопрос — мы ответим в чате.';

  return <div className={styles.workspace}>
    <header className={styles.workspaceHeader}><h1>Чаты</h1><Link to="/account?tab=profile" aria-label="Закрыть чаты">×</Link></header>
    <div className={styles.chatLayout}>
      <aside className={`${styles.chatList} ${showMobileChat ? styles.chatListHidden : ''}`} aria-label="Список чатов">
        {archiveOpen ? <>
          <div className={styles.archiveHeader}>
            <button type="button" onClick={() => setArchiveOpen(false)}>← Назад</button>
            <h2>Архив</h2>
          </div>
          <div className={styles.threadLists}>
            {chatThreads.closed.length
              ? <ChatThreadList threads={chatThreads.closed} activeId={selectedThread?.id} onSelect={selectThread} showEmpty={false} />
              : <p className={styles.archiveEmpty}>В архиве пока ничего нет</p>}
          </div>
        </> : <>
          <button type="button" className={styles.supportEntry} onClick={showStart}>
            <span className={styles.supportAvatar} aria-hidden="true">PF</span>
            <span><strong>Поддержка Print-Form</strong><small>Поможем с заказом, доставкой и оплатой</small></span>
            <span aria-hidden="true">›</span>
          </button>
          <div className={styles.threadLists}>
            <ChatThreadList threads={chatThreads.active ?? []} activeId={selectedThread?.id} onSelect={selectThread} showEmpty={false} />
            <button type="button" className={styles.archiveLink} onClick={() => setArchiveOpen(true)}>Показать архив <span aria-hidden="true">›</span></button>
          </div>
        </>}
      </aside>
      <div className={`${styles.chatWindowPane} ${showMobileChat ? styles.chatWindowActive : ''}`}>
        {selectedThread ? <ChatWindow thread={selectedThread} messages={chatMessages} loading={chatLoading} error={chatError} onSend={onSendMessage} onBack={() => setShowMobileChat(false)} />
          : <div className={styles.flowPane}>
            <header className={styles.flowHeader}>
              <button type="button" className={styles.mobileBack} onClick={() => setShowMobileChat(false)} aria-label="К списку чатов">←</button>
              <span className={styles.supportAvatar} aria-hidden="true">PF</span>
              <strong>Чат с поддержкой</strong>
            </header>
            <div className={styles.flowContent}>
              {step !== 'ROOT' && <button type="button" className={styles.flowBack} onClick={back}>← Назад</button>}
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
                <div className={styles.flowOptions}>{orderQuestions(order).map(item => <button key={item.label} type="button" onClick={() => openComposer(`Заказ ${orderNumber}. ${item.draft}`)}>{item.label}</button>)}</div>
              </>}
              {step === 'CATEGORY' && category && <div className={styles.flowOptions}>{SUPPORT_QUESTIONS[category.label].options.map(item => <button key={item.label} type="button" onClick={() => openComposer(item.draft)}>{item.label}</button>)}</div>}
              {step === 'COMPOSER' && chatError && <p className={styles.startError} role="alert">{chatError}</p>}
            </div>
            {step === 'COMPOSER' && <div className={styles.flowComposer}><MessageComposer onSend={submitQuestion} draft={draft} focusKey={focusVersion} disabled={creatingSupportThread} placeholder="Напишите ваш вопрос..." /></div>}
          </div>}
      </div>
    </div>
  </div>;
};
