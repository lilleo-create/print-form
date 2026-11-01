import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatThread } from '../../../shared/types';
import { useMyChats } from './useMyChats';

const active = { id: 'support-1', kind: 'SUPPORT', status: 'ACTIVE', supportTopic: 'Оплата',
  userId: 'buyer', returnRequestId: null, createdAt: '2026-11-01T10:00:00Z' } as ChatThread;
const closed = { ...active, status: 'CLOSED', id: 'support-old' } as ChatThread;
const userMessage = { id: 'message-1', threadId: active.id, authorRole: 'USER', authorId: 'buyer',
  text: 'Где заказ?', createdAt: '2026-11-01T10:00:01Z' } as ChatMessage;
const acknowledgementMessage = { ...userMessage, id: 'message-2', authorRole: 'ADMIN', authorId: 'SYSTEM_SUPPORT',
  text: 'Сейчас позову оператора.' } as ChatMessage;

const listMy = vi.fn();
const getThread = vi.fn();
const sendMessage = vi.fn();
const sendSupportMessage = vi.fn();
const sendQuickSupportMessage = vi.fn();
vi.mock('../../../shared/api', () => ({ api: { chats: {
  listMy: (...args: unknown[]) => listMy(...args),
  getThread: (...args: unknown[]) => getThread(...args),
  sendMessage: (...args: unknown[]) => sendMessage(...args),
  sendSupportMessage: (...args: unknown[]) => sendSupportMessage(...args),
  sendQuickSupportMessage: (...args: unknown[]) => sendQuickSupportMessage(...args)
} } }));

describe('useMyChats single active support lifecycle', () => {
  beforeEach(() => {
    listMy.mockReset().mockResolvedValue({ data: { active: [], closed: [] } });
    getThread.mockReset().mockResolvedValue({ data: { thread: active, messages: [userMessage, acknowledgementMessage] } });
    sendMessage.mockReset().mockResolvedValue({ data: userMessage });
    sendSupportMessage.mockReset().mockResolvedValue({ data: { thread: active, userMessage, acknowledgementMessage } });
    sendQuickSupportMessage.mockReset().mockResolvedValue({ data: { thread: active, userMessage, acknowledgementMessage } });
  });

  it('shows start state only when no active ordinary support thread exists', async () => {
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(listMy).toHaveBeenCalled());
    expect(result.current.selectedThread).toBeNull();
    unmount();
  });

  it('selects an existing active support thread on load regardless of its topic', async () => {
    listMy.mockResolvedValue({ data: { active: [active], closed: [] } });
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(result.current.selectedThread?.id).toBe(active.id));
    expect(getThread).toHaveBeenCalledWith(active.id);
    unmount();
  });

  it('starts free text with one support message action and shows persisted acknowledgement', async () => {
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(listMy).toHaveBeenCalled());
    await act(async () => expect(await result.current.sendNewSupportQuestion('Произвольный вопрос', { text: 'Где заказ?' })).toBe(true));
    expect(sendSupportMessage).toHaveBeenCalledWith({ topic: 'Произвольный вопрос', text: 'Где заказ?' });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(result.current.selectedThread?.id).toBe(active.id);
    expect(result.current.chatMessages.map(message => message.text)).toEqual(['Где заказ?', 'Сейчас позову оператора.']);
    unmount();
  });

  it('routes a different quick topic into the same server-managed support conversation', async () => {
    listMy.mockResolvedValue({ data: { active: [active], closed: [] } });
    sendQuickSupportMessage.mockResolvedValue({ data: { thread: active, userMessage, acknowledgementMessage: null } });
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(result.current.selectedThread?.id).toBe(active.id));
    await act(async () => expect(await result.current.sendQuickSupportQuestion('Доставка', 'Где заказ?')).toBe(true));
    expect(sendQuickSupportMessage).toHaveBeenCalledWith({ topic: 'Доставка', text: 'Где заказ?' });
    expect(result.current.selectedThread?.id).toBe(active.id);
    unmount();
  });

  it('sends manual text to the same thread after a quick question', async () => {
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(listMy).toHaveBeenCalled());
    await act(async () => expect(await result.current.sendQuickSupportQuestion('Доставка', 'Где заказ?')).toBe(true));
    expect(result.current.selectedThread?.id).toBe('support-1');
    await act(async () => expect(await result.current.handleSendMessage({ text: 'привет' })).toBe(true));
    expect(sendMessage).toHaveBeenCalledWith('support-1', { text: 'привет' });
    expect(sendSupportMessage).not.toHaveBeenCalled();
    expect(sendQuickSupportMessage).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('moves a closed support thread to archive and restores start state on polling refresh', async () => {
    listMy.mockResolvedValue({ data: { active: [active], closed: [] } });
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(result.current.selectedThread?.id).toBe(active.id));
    listMy.mockResolvedValue({ data: { active: [], closed: [closed] } });
    await act(async () => { await result.current.refreshThreads(); });
    expect(result.current.chatThreads.closed).toHaveLength(1);
    expect(result.current.chatThreads.active).toHaveLength(0);
    expect(result.current.selectedThread).toBeNull();
    unmount();
  });

  it('preserves a failed free-text question and guards concurrent sends', async () => {
    let resolveSend!: (value: unknown) => void;
    sendSupportMessage.mockReturnValueOnce(new Promise(resolve => { resolveSend = resolve; }));
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(listMy).toHaveBeenCalled());
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.sendNewSupportQuestion('Доставка', { text: 'Вопрос' });
      second = result.current.sendNewSupportQuestion('Оплата', { text: 'Вопрос' });
    });
    expect(await second).toBe(false);
    resolveSend({ data: { thread: active, userMessage, acknowledgementMessage } });
    await act(async () => expect(await first).toBe(true));
    expect(sendSupportMessage).toHaveBeenCalledTimes(1);
    unmount();
  });
});
