import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatThread } from '../../../shared/types';
import { useMyChats } from './useMyChats';

const existing = { id: 'thread-1', kind: 'SUPPORT', status: 'ACTIVE', supportTopic: 'Доставка',
  userId: 'buyer', createdAt: '2026-10-31T10:00:00Z' } as ChatThread;
const listMy = vi.fn();
const createSupportThread = vi.fn();
const getThread = vi.fn();
const sendMessage = vi.fn();
const sendQuickSupportMessage = vi.fn();
vi.mock('../../../shared/api', () => ({
  api: { chats: { listMy: (...args: unknown[]) => listMy(...args),
    createSupportThread: (...args: unknown[]) => createSupportThread(...args),
    getThread: (...args: unknown[]) => getThread(...args),
    sendMessage: (...args: unknown[]) => sendMessage(...args),
    sendQuickSupportMessage: (...args: unknown[]) => sendQuickSupportMessage(...args) } }
}));

describe('useMyChats support flow', () => {
  beforeEach(() => {
    listMy.mockReset().mockResolvedValue({ data: { active: [existing], closed: [] } });
    createSupportThread.mockReset();
    getThread.mockReset().mockResolvedValue({ data: { thread: existing, messages: [] } });
    sendMessage.mockReset().mockResolvedValue({ data: {} });
    sendQuickSupportMessage.mockReset();
  });

  it('opens the support start screen instead of auto-selecting a thread', async () => {
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(result.current.chatThreads.active).toHaveLength(1));
    expect(result.current.selectedThread).toBeNull();
    unmount();
  });

  it('reuses an active support thread with the same topic', async () => {
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(result.current.chatThreads.active).toHaveLength(1));
    await act(async () => { expect(await result.current.createSupportThread('Доставка')).toEqual(existing); });
    expect(createSupportThread).not.toHaveBeenCalled();
    expect(result.current.selectedThread?.id).toBe('thread-1');
    unmount();
  });

  it('creates a thread only on send and sends the message once', async () => {
    const created = { ...existing, id: 'new-thread', supportTopic: 'Оплата и возврат средств' };
    createSupportThread.mockResolvedValue({ data: { thread: created, created: true, topic: created.supportTopic } });
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(result.current.chatThreads.active).toHaveLength(1));
    expect(createSupportThread).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current.sendNewSupportQuestion('Оплата и возврат средств', 'Вопрос по оплате')).toBe(true);
    });
    expect(createSupportThread).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith('new-thread', { text: 'Вопрос по оплате' });
    expect(sendMessage).not.toHaveBeenCalledWith('undefined', expect.anything());
    expect(sendMessage).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('reuses an active thread when sending a new question', async () => {
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(result.current.chatThreads.active).toHaveLength(1));
    await act(async () => {
      expect(await result.current.sendNewSupportQuestion('Доставка', 'Где заказ?')).toBe(true);
    });
    expect(createSupportThread).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith('thread-1', { text: 'Где заказ?' });
    unmount();
  });

  it('does not create another empty thread when a failed send is retried', async () => {
    const created = { ...existing, id: 'new-thread', supportTopic: 'Оплата и возврат средств' };
    createSupportThread.mockResolvedValue({ data: { thread: created, created: true, topic: created.supportTopic } });
    sendMessage.mockRejectedValueOnce(new Error('network'));
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(result.current.chatThreads.active).toHaveLength(1));
    await act(async () => {
      expect(await result.current.sendNewSupportQuestion('Оплата и возврат средств', 'Вопрос')).toBe(false);
    });
    await act(async () => {
      expect(await result.current.sendNewSupportQuestion('Оплата и возврат средств', 'Вопрос')).toBe(true);
    });
    expect(createSupportThread).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('blocks concurrent sends before a thread is created', async () => {
    const created = { ...existing, id: 'new-thread', supportTopic: 'Оплата и возврат средств' };
    let finishCreate!: (value: { data: { thread: ChatThread; created: boolean; topic: string } }) => void;
    createSupportThread.mockReturnValue(new Promise(resolve => { finishCreate = resolve; }));
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(result.current.chatThreads.active).toHaveLength(1));
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.sendNewSupportQuestion('Оплата и возврат средств', 'Вопрос');
      second = result.current.sendNewSupportQuestion('Оплата и возврат средств', 'Вопрос');
    });
    expect(await second).toBe(false);
    finishCreate({ data: { thread: created, created: true, topic: created.supportTopic! } });
    await act(async () => { expect(await first).toBe(true); });
    expect(createSupportThread).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('stores a quick question and provider acknowledgement through one API action', async () => {
    const quickThread = { ...existing, id: 'quick-thread' };
    const userMessage = { id: 'user-message', threadId: quickThread.id, authorRole: 'USER', text: 'Где заказ?' };
    const acknowledgementMessage = { id: 'ack-message', threadId: quickThread.id, authorRole: 'ADMIN', text: 'Сейчас позову оператора.' };
    sendQuickSupportMessage.mockResolvedValue({ data: { thread: quickThread, userMessage, acknowledgementMessage } });
    getThread.mockResolvedValue({ data: { thread: quickThread, messages: [userMessage, acknowledgementMessage] } });
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(result.current.chatThreads.active).toHaveLength(1));
    await act(async () => {
      expect(await result.current.sendQuickSupportQuestion('Доставка', 'Где заказ?')).toBe(true);
    });
    expect(sendQuickSupportMessage).toHaveBeenCalledWith({ topic: 'Доставка', text: 'Где заказ?' });
    expect(result.current.chatMessages.map(message => message.text)).toEqual(['Где заказ?', 'Сейчас позову оператора.']);
    expect(createSupportThread).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    unmount();
  });
});
