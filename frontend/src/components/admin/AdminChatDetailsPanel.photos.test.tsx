import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatThread } from '../../shared/types';
import { AdminChatDetailsPanel } from './AdminChatDetailsPanel';

describe('AdminChatDetailsPanel photos', () => {
  it('shows buyer images and lets admin select an image for a reply', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:admin-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AdminChatDetailsPanel
      thread={{ id: 'chat-1', kind: 'SUPPORT', status: 'ACTIVE', userId: 'buyer', createdAt: '' } as ChatThread}
      messages={[{ id: 'm', threadId: 'chat-1', authorRole: 'USER', authorId: 'buyer', text: '', createdAt: new Date().toISOString(),
        attachments: [{ id: 'a', messageId: 'm', type: 'IMAGE', url: '/uploads/chats/a.png', fileName: 'a.png', mime: 'image/png', size: 10, createdAt: '' }] }]}
      onSend={onSend} onUpdateReturnStatus={vi.fn()} onUpdateThreadStatus={vi.fn()}
    />);
    expect(screen.getByRole('img', { name: 'a.png' })).toBeInTheDocument();
    const reply = new File(['png'], 'reply.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Выбрать фотографии'), { target: { files: [reply] } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ text: '', files: [reply] }));
  });
});
