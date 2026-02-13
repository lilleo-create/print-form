import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../shared/api';
import { ChatMessage, ChatThread } from '../../../shared/types';

const emptyThreads = { active: [], closed: [] } as { active: ChatThread[]; closed: ChatThread[] };

export const useMyChats = (activeTab: string, threadIdParam: string | null) => {
  const [chatThreads, setChatThreads] = useState<{ active: ChatThread[]; closed: ChatThread[] }>(
    emptyThreads
  );
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'chats') return;
    let isMounted = true;
    api.chats
      .listMy()
      .then((response) => {
        if (!isMounted) return;
        const data = response.data ?? emptyThreads;
        const allThreads = [...(data.active ?? []), ...(data.closed ?? [])];
        setChatThreads(data);
        setSelectedThread((prev) => {
          if (threadIdParam) {
            return (
              allThreads.find((thread) => thread.id === threadIdParam) ??
              prev ??
              data.active?.[0] ??
              data.closed?.[0] ??
              null
            );
          }
          return prev ?? data.active?.[0] ?? data.closed?.[0] ?? null;
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setChatThreads(emptyThreads);
      });
    return () => {
      isMounted = false;
    };
  }, [activeTab, threadIdParam]);

  const loadChatThread = useCallback(async (threadId: string) => {
    setChatLoading(true);
    setChatError(null);
    try {
      const response = await api.chats.getThread(threadId);
      setSelectedThread(response.data.thread);
      setChatMessages(response.data.messages ?? []);
    } catch {
      setChatMessages([]);
      setChatError('Не удалось загрузить чат.');
    } finally {
      setChatLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedThread || activeTab !== 'chats') return;
    loadChatThread(selectedThread.id);
    const interval = window.setInterval(() => {
      loadChatThread(selectedThread.id);
    }, 7000);
    return () => window.clearInterval(interval);
  }, [activeTab, loadChatThread, selectedThread?.id]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!selectedThread) return;
      try {
        await api.chats.sendMessage(selectedThread.id, { text });
        await loadChatThread(selectedThread.id);
        const refreshed = await api.chats.listMy();
        setChatThreads(refreshed.data ?? emptyThreads);
      } catch {
        setChatError('Не удалось отправить сообщение.');
      }
    },
    [loadChatThread, selectedThread]
  );

  return {
    chatThreads,
    selectedThread,
    setSelectedThread,
    chatMessages,
    chatLoading,
    chatError,
    handleSendMessage
  };
};
