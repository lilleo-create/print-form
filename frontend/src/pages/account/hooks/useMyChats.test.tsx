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
vi.mock('../../../shared/api', () => ({
  api: { chats: { listMy: (...args: unknown[]) => listMy(...args),
    createSupportThread: (...args: unknown[]) => createSupportThread(...args),
    getThread: (...args: unknown[]) => getThread(...args),
    sendMessage: (...args: unknown[]) => sendMessage(...args) } }
}));

describe('useMyChats support flow', () => {
  beforeEach(() => {
    listMy.mockReset().mockResolvedValue({ data: { active: [existing], closed: [] } });
    createSupportThread.mockReset();
    getThread.mockReset().mockResolvedValue({ data: { thread: existing, messages: [] } });
    sendMessage.mockReset().mockResolvedValue({ data: {} });
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
    createSupportThread.mockResolvedValue({ data: created });
    const { result, unmount } = renderHook(() => useMyChats('chats', null));
    await waitFor(() => expect(result.current.chatThreads.active).toHaveLength(1));
    expect(createSupportThread).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current.sendNewSupportQuestion('Оплата и возврат средств', 'Вопрос по оплате')).toBe(true);
    });
    expect(createSupportThread).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith('new-thread', { text: 'Вопрос по оплате' });
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
    createSupportThread.mockResolvedValue({ data: created });
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
    let finishCreate!: (value: { data: ChatThread }) => void;
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
    finishCreate({ data: created });
    await act(async () => { expect(await first).toBe(true); });
    expect(createSupportThread).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    unmount();
  });
});
