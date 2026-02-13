import { ChatThread } from '../../shared/types';
import styles from './AdminChatList.module.css';

interface AdminChatListProps {
  title: string;
  threads: ChatThread[];
  activeId?: string | null;
  onSelect: (thread: ChatThread) => void;
}

export const AdminChatList = ({ title, threads, activeId, onSelect }: AdminChatListProps) => {
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
                <strong>{thread.user?.name ?? 'Пользователь'}</strong>
                <p className={styles.preview}>{thread.lastMessage?.text ?? 'Нет сообщений'}</p>
              </div>
              <span className={styles.badge}>{thread.status}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
