import { ChatMessage, ChatThread } from '../../../../shared/types';
import { ChatThreadList } from '../../../../components/chats/ChatThreadList';
import { ChatWindow } from '../../../../components/chats/ChatWindow';
import styles from './ChatsTab.module.css';

interface ChatsTabProps {
  chatThreads: { active: ChatThread[]; closed: ChatThread[] };
  selectedThread: ChatThread | null;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  chatError: string | null;
  onSelectThread: (thread: ChatThread) => void;
  onSendMessage: (text: string) => void;
}

export const ChatsTab = ({
  chatThreads,
  selectedThread,
  chatMessages,
  chatLoading,
  chatError,
  onSelectThread,
  onSendMessage
}: ChatsTabProps) => {
  return (
    <div className={styles.chatLayout}>
      <div className={styles.chatList}>
        <ChatThreadList
          title="Активные"
          threads={chatThreads.active ?? []}
          activeId={selectedThread?.id}
          onSelect={onSelectThread}
        />
        <ChatThreadList
          title="Завершенные"
          threads={chatThreads.closed ?? []}
          activeId={selectedThread?.id}
          onSelect={onSelectThread}
        />
      </div>
      <ChatWindow
        thread={selectedThread}
        messages={chatMessages}
        loading={chatLoading}
        error={chatError}
        onSend={onSendMessage}
      />
    </div>
  );
};
