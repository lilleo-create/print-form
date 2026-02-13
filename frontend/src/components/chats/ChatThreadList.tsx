import { ChatThread } from '../../shared/types';
import styles from './ChatThreadList.module.css';

interface ChatThreadListProps {
  title: string;
  threads: ChatThread[];
  activeId?: string | null;
  onSelect: (thread: ChatThread) => void;
}

export const ChatThreadList = ({ title, threads, activeId, onSelect }: ChatThreadListProps) => {
  return (
    <section className={styles.section}>
      <h3>{title}</h3>
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
              <div>
                <strong>{thread.kind === 'SUPPORT' ? 'Поддержка' : 'Продавец'}</strong>
                <p className={styles.preview}>{thread.lastMessage?.text ?? 'Нет сообщений'}</p>
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
