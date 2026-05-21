import { ChatThread } from '../../shared/types';
import styles from './ChatThreadList.module.css';

interface ChatThreadListProps {
  title: string;
  threads: ChatThread[];
  activeId?: string | null;
  onSelect: (thread: ChatThread) => void;
}

const getThreadTitle = (thread: ChatThread) => {
  if (thread.returnRequest) return 'Возврат и поддержка';
  if (thread.kind === 'SUPPORT') {
    return thread.supportTopic ? `Поддержка · ${thread.supportTopic}` : 'Поддержка';
  }
  return thread.sellerShopName ? `Продавец · ${thread.sellerShopName}` : 'Продавец';
};

export const ChatThreadList = ({ title, threads, activeId, onSelect }: ChatThreadListProps) => {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {threads.length === 0 ? (
        <p className={styles.empty}>Нет чатов.</p>
      ) : (
        <div className={styles.list}>
          {threads.map((thread) => (
            <button
              type="button"
              key={thread.id}
              className={activeId === thread.id ? styles.itemActive : styles.item}
              onClick={() => onSelect(thread)}
            >
              <div className={styles.itemBody}>
                <span className={styles.itemTitle}>{getThreadTitle(thread)}</span>
                <span className={styles.preview}>
                  {thread.lastMessage?.text ?? 'Нет сообщений'}
                </span>
              </div>
              {thread.lastMessageAt && (
                <span className={styles.date}>
                  {new Date(thread.lastMessageAt).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit'
                  })}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
