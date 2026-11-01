import { useEffect, useState } from 'react';
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
  const [draftEdited, setDraftEdited] = useState(false);
  const [selectedLeaf, setSelectedLeaf] = useState<string | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);

  useEffect(() => { if (selectedThread) setShowMobileChat(true); }, [selectedThread?.id]);

  const resetFlow = () => {
    setStep('ROOT');
    setOrder(null);
    setCategory(null);
    setDraft('');
    setDraftEdited(false);
    setSelectedLeaf(null);
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
    setSelectedLeaf(null);
    setStep('ORDER');
  };
  const openComposer = (nextDraft: string, leaf?: string) => {
    const preserveDraft = draftEdited && Boolean(draft.trim());
    setDraft(preserveDraft ? draft : nextDraft);
    setDraftEdited(preserveDraft);
    setSelectedLeaf(leaf ?? null);
    setStep('COMPOSER');
    setFocusVersion(version => version + 1);
  };
  const chooseCategory = (nextCategory: SupportTopic) => {
    setOrder(null);
    setCategory(nextCategory);
    if (nextCategory.label === 'Другой вопрос') {
      setSelectedLeaf(null);
      setFocusVersion(version => version + 1);
      setStep('ROOT');
    } else {
      setSelectedLeaf(null);
      setStep('CATEGORY');
    }
  };
  const changeContext = () => {
    if (step === 'COMPOSER' && selectedLeaf) {
      setSelectedLeaf(null);
      setStep(order ? 'ORDER' : category?.label === 'Другой вопрос' ? 'ROOT' : 'CATEGORY');
      return;
    }
    setStep('ROOT');
    setOrder(null);
    setCategory(null);
    setSelectedLeaf(null);
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
        : order ? `Что хотите уточнить по заказу ${orderNumber}?`
          : SUPPORT_QUESTIONS[category?.label ?? '']?.prompt ?? 'Здравствуйте! С чем помочь?';
  const contextLabel = step === 'ORDER' ? `Заказ ${orderNumber}`
    : step === 'COMPOSER' && selectedLeaf ? selectedLeaf : category?.label;
  const showThread = selectedThread && (!archiveOpen || selectedThread.status === 'CLOSED');
  const backArchive = () => {
    setArchiveOpen(false);
    setShowMobileChat(false);
    if (selectedThread?.status === 'CLOSED') onShowSupportStart();
  };

  return <div className={styles.workspace}>
    <header className={styles.workspaceHeader}>
      {archiveOpen && <button type="button" className={styles.archiveBack} aria-label="Вернуться к чатам" onClick={backArchive}>←</button>}
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
          <button type="button" className={styles.supportEntry} onClick={showStart}>
            <span className={styles.supportAvatar} aria-hidden="true">PF</span>
            <span><strong>Поддержка Print-Form</strong><small>Поможем с заказом, доставкой и оплатой</small></span>
            <span aria-hidden="true">›</span>
          </button>
          <div className={styles.threadLists}>
            <ChatThreadList threads={chatThreads.active ?? []} activeId={selectedThread?.id} onSelect={selectThread} showEmpty={false} />
            <button type="button" className={styles.archiveLink} onClick={() => {
              setArchiveOpen(true);
              setShowMobileChat(false);
            }}>Показать архив <span aria-hidden="true">›</span></button>
          </div>
        </>}
      </aside>
      <div className={`${styles.chatWindowPane} ${showMobileChat ? styles.chatWindowActive : ''}`}>
        {showThread ? <ChatWindow thread={selectedThread} messages={chatMessages} loading={chatLoading} error={chatError} onSend={onSendMessage} onBack={() => setShowMobileChat(false)} />
          : archiveOpen ? <div className={styles.archivePrompt}>Выберите диалог из архива</div>
          : <div className={styles.flowPane}>
            <header className={styles.flowHeader}>
              <button type="button" className={styles.mobileBack} onClick={() => setShowMobileChat(false)} aria-label="К списку чатов">←</button>
              <span className={styles.supportAvatar} aria-hidden="true">PF</span>
              <strong>Чат с поддержкой</strong>
            </header>
            <div className={styles.flowContent}>
              <div className={styles.flowInner}>
              {step !== 'ROOT' && <div className={styles.flowContext}><span>{contextLabel}</span><button type="button" onClick={changeContext}>Изменить</button></div>}
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
                <div className={styles.flowOptions}>{orderQuestions(order).map(item => <button key={item.label} type="button" onClick={() => openComposer(`Заказ ${orderNumber}. ${item.draft}`, item.label)}>{item.label}</button>)}</div>
              </>}
              {step === 'CATEGORY' && category && <div className={styles.flowOptions}>{SUPPORT_QUESTIONS[category.label].options.map(item => <button key={item.label} type="button" onClick={() => openComposer(item.draft, item.label)}>{item.label}</button>)}</div>}
              {step === 'COMPOSER' && chatError && <p className={styles.startError} role="alert">{chatError}</p>}
              </div>
            </div>
            <div className={styles.flowComposer}><MessageComposer onSend={submitQuestion} draft={draft} focusKey={focusVersion} onValueChange={value => {
              setDraft(value);
              setDraftEdited(true);
            }} disabled={creatingSupportThread} placeholder="Напишите ваш вопрос..." /></div>
          </div>}
      </div>
    </div>
  </div>;
};
