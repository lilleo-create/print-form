import { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { ChatMessage, ChatThread, ReturnStatus } from '../../shared/types';
import { AdminChatList } from '../../components/admin/AdminChatList';
import { AdminChatDetailsPanel } from '../../components/admin/AdminChatDetailsPanel';
import styles from './AdminChatsPage.module.css';

export const AdminChatsPage = () => {
  const [threads, setThreads] = useState<{ active: ChatThread[]; closed: ChatThread[] }>({
    active: [],
    closed: []
  });
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadThreads = async (query?: string) => {
    const response = await api.adminChats.listAll({ q: query?.trim() || undefined });
    setThreads(response.data ?? { active: [], closed: [] });
  };

  const loadThread = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.adminChats.getThread(id);
      setSelectedThread(response.data.thread);
      setMessages(response.data.messages ?? []);
    } catch {
      setMessages([]);
      setError('Не удалось загрузить чат.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThreads(search).catch(() => setThreads({ active: [], closed: [] }));
  }, [search]);

  useEffect(() => {
    if (!selectedThread && threads.active[0]) {
      setSelectedThread(threads.active[0]);
      loadThread(threads.active[0].id).catch(() => undefined);
    }
  }, [threads, selectedThread]);

  const handleSend = async (text: string) => {
    if (!selectedThread) return;
    await api.adminChats.sendMessage(selectedThread.id, { text });
    await loadThread(selectedThread.id);
    await loadThreads();
  };

  const handleUpdateReturnStatus = async (status: ReturnStatus, comment?: string) => {
    if (!selectedThread?.returnRequest) return;
    await api.adminChats.updateReturnStatus(selectedThread.returnRequest.id, {
      status,
      adminComment: comment
    });
    await loadThread(selectedThread.id);
  };

  const handleUpdateThreadStatus = async (status: 'ACTIVE' | 'CLOSED') => {
    if (!selectedThread) return;
    await api.adminChats.updateThreadStatus(selectedThread.id, { status });
    await loadThreads();
    await loadThread(selectedThread.id);
  };

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.search}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по email или ID"
            />
          </div>
          <AdminChatList
            title="Активные"
            threads={threads.active ?? []}
            activeId={selectedThread?.id}
            onSelect={(thread) => {
              setSelectedThread(thread);
              loadThread(thread.id).catch(() => undefined);
            }}
          />
          <AdminChatList
            title="Завершенные"
            threads={threads.closed ?? []}
            activeId={selectedThread?.id}
            onSelect={(thread) => {
              setSelectedThread(thread);
              loadThread(thread.id).catch(() => undefined);
            }}
          />
        </aside>
        <div className={styles.content}>
          {loading && <p>Загрузка чата...</p>}
          {error && <p className={styles.error}>{error}</p>}
          {!loading && !error && (
            <AdminChatDetailsPanel
              thread={selectedThread}
              messages={messages}
              onSend={handleSend}
              onUpdateReturnStatus={handleUpdateReturnStatus}
              onUpdateThreadStatus={handleUpdateThreadStatus}
            />
          )}
        </div>
      </div>
    </section>
  );
};
