import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../shared/api';
import { ChatMessage, ChatThread } from '../../../shared/types';

const emptyThreads = { active: [], closed: [] } as {
  active: ChatThread[];
  closed: ChatThread[];
};

const mergeThreads = (
  data: { active: ChatThread[]; closed: ChatThread[] } | undefined
) => [...(data?.active ?? []), ...(data?.closed ?? [])];

export const useMyChats = (activeTab: string, threadIdParam: string | null) => {
  const [chatThreads, setChatThreads] = useState<{
    active: ChatThread[];
    closed: ChatThread[];
  }>(emptyThreads);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [creatingSupportThread, setCreatingSupportThread] = useState(false);

  const refreshThreads = useCallback(
    async (preferredThreadId?: string | null) => {
      const response = await api.chats.listMy();
      const data = response.data ?? emptyThreads;
      const allThreads = mergeThreads(data);
      setChatThreads(data);
      setSelectedThread((prev) => {
        const targetId = preferredThreadId ?? threadIdParam;
        if (targetId) {
          return (
            allThreads.find((thread) => thread.id === targetId) ??
            prev ??
            allThreads[0] ??
            null
          );
        }
        return prev
          ? (allThreads.find((thread) => thread.id === prev.id) ?? prev)
          : (allThreads[0] ?? null);
      });
      return data;
    },
    [threadIdParam]
  );

  useEffect(() => {
    if (activeTab !== 'chats') return;
    let isMounted = true;
    refreshThreads().catch(() => {
      if (!isMounted) return;
      setChatThreads(emptyThreads);
    });
    return () => {
      isMounted = false;
    };
  }, [activeTab, refreshThreads]);

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
        await refreshThreads(selectedThread.id);
      } catch {
        setChatError('Не удалось отправить сообщение.');
      }
    },
    [loadChatThread, refreshThreads, selectedThread]
  );

  const createSupportThread = useCallback(
    async (topic: string) => {
      setCreatingSupportThread(true);
      setChatError(null);
      try {
        const response = await api.chats.createSupportThread({ topic });
        await refreshThreads(response.data.id);
        await loadChatThread(response.data.id);
        return response.data;
      } catch {
        setChatError('Не удалось создать обращение в поддержку.');
        return null;
      } finally {
        setCreatingSupportThread(false);
      }
    },
    [loadChatThread, refreshThreads]
  );

  return {
    chatThreads,
    selectedThread,
    setSelectedThread,
    chatMessages,
    chatLoading,
    chatError,
    creatingSupportThread,
    handleSendMessage,
    createSupportThread
  };
};
