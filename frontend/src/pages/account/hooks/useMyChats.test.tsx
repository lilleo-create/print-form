import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatThread } from '../../../shared/types';
import { useMyChats } from './useMyChats';

const existing = { id: 'thread-1', kind: 'SUPPORT', status: 'ACTIVE', supportTopic: 'Доставка',
  userId: 'buyer', createdAt: '2026-10-31T10:00:00Z' } as ChatThread;
const listMy = vi.fn();
const createSupportThread = vi.fn();
const getThread = vi.fn();
vi.mock('../../../shared/api', () => ({
  api: { chats: { listMy: (...args: unknown[]) => listMy(...args),
    createSupportThread: (...args: unknown[]) => createSupportThread(...args),
    getThread: (...args: unknown[]) => getThread(...args),
    sendMessage: vi.fn() } }
}));

describe('useMyChats support flow', () => {
  beforeEach(() => {
    listMy.mockReset().mockResolvedValue({ data: { active: [existing], closed: [] } });
    createSupportThread.mockReset();
    getThread.mockReset().mockResolvedValue({ data: { thread: existing, messages: [] } });
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
});
