import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageComposer } from './MessageComposer';

describe('MessageComposer', () => {
  it('sends once on Enter and clears after success', async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<MessageComposer onSend={onSend} />);
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Привет' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend).toHaveBeenCalledWith('Привет');
    await waitFor(() => expect(field).toHaveValue(''));
  });

  it('keeps Shift+Enter as a newline and does not send empty text', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const field = screen.getByRole('textbox');
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.change(field, { target: { value: 'Строка' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('ignores composing Enter and repeated Enter while sending', async () => {
    let finish!: (value: boolean) => void;
    const onSend = vi.fn().mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<MessageComposer onSend={onSend} />);
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Вопрос' } });
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledTimes(1);
    finish(true);
    await waitFor(() => expect(field).toHaveValue(''));
  });

  it('preserves text when send fails', async () => {
    const onSend = vi.fn().mockResolvedValue(false);
    render(<MessageComposer onSend={onSend} />);
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Повторить' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(field).toHaveValue('Повторить');
  });
});
