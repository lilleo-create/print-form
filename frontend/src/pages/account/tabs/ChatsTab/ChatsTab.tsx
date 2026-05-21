import { useState } from 'react';
import { ChatMessage, ChatThread } from '../../../../shared/types';
import { Button } from '../../../../shared/ui/Button';
import { ChatThreadList } from '../../../../components/chats/ChatThreadList';
import { ChatWindow } from '../../../../components/chats/ChatWindow';
import styles from './ChatsTab.module.css';

const SUPPORT_TOPICS = [
  'Проблема с заказом',
  'Оплата и возврат средств',
  'Доставка',
  'Произвольный вопрос'
];

interface ChatsTabProps {
  chatThreads: { active: ChatThread[]; closed: ChatThread[] };
  selectedThread: ChatThread | null;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  chatError: string | null;
  creatingSupportThread: boolean;
  onSelectThread: (thread: ChatThread) => void;
  onSendMessage: (text: string) => void;
  onCreateSupportThread: (topic: string) => Promise<ChatThread | null>;
}

export const ChatsTab = ({
  chatThreads,
  selectedThread,
  chatMessages,
  chatLoading,
  chatError,
  creatingSupportThread,
  onSelectThread,
  onSendMessage,
  onCreateSupportThread
}: ChatsTabProps) => {
  const [isTopicPickerOpen, setTopicPickerOpen] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const handleTopicSelect = async (topic: string) => {
    const thread = await onCreateSupportThread(topic);
    if (thread) {
      setTopicPickerOpen(false);
    }
  };

  const handleSelectThread = (thread: ChatThread) => {
    onSelectThread(thread);
    setShowMobileChat(true);
  };

  const handleBack = () => {
    setShowMobileChat(false);
  };

  return (
    <div className={styles.chatLayout}>
      <div className={`${styles.chatList} ${showMobileChat ? styles.chatListHidden : ''}`}>
        <div className={styles.supportCard}>
          <div className={styles.supportCardText}>
            <strong>Поддержка Print-Form</strong>
            <p>Создайте новое обращение и выберите тему перед открытием чата.</p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setTopicPickerOpen((prev) => !prev)}
            isLoading={creatingSupportThread}
          >
            Начать обращение
          </Button>
          {isTopicPickerOpen && (
            <div className={styles.topicPicker}>
              {SUPPORT_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className={styles.topicButton}
                  onClick={() => void handleTopicSelect(topic)}
                  disabled={creatingSupportThread}
                >
                  {topic}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.threadLists}>
          <ChatThreadList
            title="Активные"
            threads={chatThreads.active ?? []}
            activeId={selectedThread?.id}
            onSelect={handleSelectThread}
          />
          <ChatThreadList
            title="Завершенные"
            threads={chatThreads.closed ?? []}
            activeId={selectedThread?.id}
            onSelect={handleSelectThread}
          />
        </div>
      </div>

      <div className={`${styles.chatWindowPane} ${!showMobileChat ? styles.chatWindowHidden : ''}`}>
        <ChatWindow
          thread={selectedThread}
          messages={chatMessages}
          loading={chatLoading}
          error={chatError}
          onSend={onSendMessage}
          onBack={handleBack}
        />
      </div>
    </div>
  );
};
