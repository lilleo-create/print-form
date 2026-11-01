import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMessageImages } from './ChatMessageImages';

describe('ChatMessageImages', () => {
  it('renders one or multiple persisted photos as openable images', () => {
    render(<ChatMessageImages attachments={[
      { id: 'a', messageId: 'm', type: 'IMAGE', url: '/uploads/chats/a.png', fileName: 'a.png', mime: 'image/png', size: 10, createdAt: '' },
      { id: 'b', messageId: 'm', type: 'IMAGE', url: '/uploads/chats/b.png', fileName: 'b.png', mime: 'image/png', size: 10, createdAt: '' }
    ]} />);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Открыть фото a.png' })).toHaveAttribute('target', '_blank');
  });
});
