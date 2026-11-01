import { useCallback, useEffect, useRef, useState } from 'react';
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
  const createInFlight = useRef(false);
  const submitInFlight = useRef(false);
  const pendingSupportThreads = useRef<Record<string, ChatThread>>({});

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
          : null;
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
      if (createInFlight.current) return null;
      const existing = chatThreads.active.find(thread => thread.kind === 'SUPPORT' && !thread.returnRequest && thread.supportTopic === topic);
      if (existing) {
        setSelectedThread(existing);
        return existing;
      }
      createInFlight.current = true;
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
        createInFlight.current = false;
        setCreatingSupportThread(false);
      }
    },
    [chatThreads.active, loadChatThread, refreshThreads]
  );

  const sendNewSupportQuestion = useCallback(
    async (topic: string, text: string): Promise<boolean> => {
      if (submitInFlight.current || !text.trim()) return false;
      submitInFlight.current = true;
      setCreatingSupportThread(true);
      setChatError(null);
      try {
        let thread = chatThreads.active.find(item => item.kind === 'SUPPORT' && !item.returnRequest && item.supportTopic === topic)
          ?? pendingSupportThreads.current[topic];
        if (!thread) {
          const response = await api.chats.createSupportThread({ topic });
          thread = response.data;
          pendingSupportThreads.current[topic] = thread;
        }
        await api.chats.sendMessage(thread.id, { text: text.trim() });
        delete pendingSupportThreads.current[topic];
        setSelectedThread(thread);
        await Promise.allSettled([loadChatThread(thread.id), refreshThreads(thread.id)]);
        return true;
      } catch {
        setChatError('Не удалось отправить вопрос. Попробуйте ещё раз.');
        return false;
      } finally {
        submitInFlight.current = false;
        setCreatingSupportThread(false);
      }
    },
    [chatThreads.active, loadChatThread, refreshThreads]
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
    createSupportThread,
    sendNewSupportQuestion
  };
};
