import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../shared/api';
import type { ChatSendPayload } from '../../../shared/api/api';
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
  const submitInFlight = useRef(false);
  const quickInFlight = useRef(false);

  const isOrdinarySupport = (thread: ChatThread) => thread.kind === 'SUPPORT' && !thread.returnRequestId && !thread.returnRequest;

  const refreshThreads = useCallback(
    async (preferredThreadId?: string | null) => {
      const response = await api.chats.listMy();
      const data = response.data ?? emptyThreads;
      const allThreads = mergeThreads(data);
      const activeSupport = data.active.find(isOrdinarySupport) ?? null;
      setChatThreads(data);
      setSelectedThread((prev) => {
        const targetId = preferredThreadId ?? threadIdParam;
        if (targetId) {
          return (
            allThreads.find((thread) => thread.id === targetId) ??
            prev ??
            activeSupport
          );
        }
        if (!prev) return activeSupport;
        const refreshed = allThreads.find(thread => thread.id === prev.id);
        if (isOrdinarySupport(prev) && prev.status === 'ACTIVE' && refreshed?.status !== 'ACTIVE') return activeSupport;
        return refreshed ?? activeSupport;
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
      setSelectedThread(prev => {
        if (response.data.thread.status === 'CLOSED' && prev?.status === 'ACTIVE' && isOrdinarySupport(response.data.thread)) return null;
        return response.data.thread;
      });
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
      refreshThreads().catch(() => undefined);
    }, 7000);
    return () => window.clearInterval(interval);
  }, [activeTab, loadChatThread, refreshThreads, selectedThread?.id]);

  const handleSendMessage = useCallback(
    async (payload: ChatSendPayload) => {
      if (!selectedThread) return false;
      try {
        await api.chats.sendMessage(selectedThread.id, payload);
        await loadChatThread(selectedThread.id);
        await refreshThreads(selectedThread.id);
        return true;
      } catch {
        setChatError('Не удалось отправить сообщение.');
        return false;
      }
    },
    [loadChatThread, refreshThreads, selectedThread]
  );

  const sendNewSupportQuestion = useCallback(
    async (topic: string, payload: ChatSendPayload): Promise<boolean> => {
      if (submitInFlight.current || (!payload.text.trim() && !payload.files?.length)) return false;
      submitInFlight.current = true;
      setCreatingSupportThread(true);
      setChatError(null);
      try {
        const response = await api.chats.sendSupportMessage({ ...payload, text: payload.text.trim(), topic });
        const { thread, userMessage, acknowledgementMessage } = response.data;
        setSelectedThread(thread);
        setChatMessages([userMessage, ...(acknowledgementMessage ? [acknowledgementMessage] : [])]);
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
    [loadChatThread, refreshThreads]
  );

  const sendQuickSupportQuestion = useCallback(
    async (topic: string, text: string): Promise<boolean> => {
      if (quickInFlight.current || !text.trim()) return false;
      quickInFlight.current = true;
      setCreatingSupportThread(true);
      setChatError(null);
      try {
        const response = await api.chats.sendQuickSupportMessage({ topic, text: text.trim() });
        const { thread, userMessage, acknowledgementMessage } = response.data;
        setSelectedThread(thread);
        setChatMessages([userMessage, ...(acknowledgementMessage ? [acknowledgementMessage] : [])]);
        await Promise.allSettled([loadChatThread(thread.id), refreshThreads(thread.id)]);
        return true;
      } catch {
        setChatError('Не удалось отправить вопрос. Попробуйте ещё раз.');
        return false;
      } finally {
        quickInFlight.current = false;
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
    refreshThreads,
    chatError,
    creatingSupportThread,
    handleSendMessage,
    sendNewSupportQuestion,
    sendQuickSupportQuestion
  };
};
