import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ChatThread, Order } from '../../../../shared/types';
import { ChatsTab } from './ChatsTab';

const thread = (id: string, topic = 'Доставка', status: ChatThread['status'] = 'ACTIVE') =>
  ({ id, kind: 'SUPPORT', userId: 'buyer', status, supportTopic: topic, createdAt: '2026-10-31T12:00:00Z' }) as ChatThread;
const order = (id: string, number: string) =>
  ({ id, publicNumber: number, status: 'PAID', paymentStatus: 'PAID', createdAt: '2026-10-31T12:00:00Z',
    items: [{ productId: id, title: `Товар ${number}`, qty: 1 }] }) as Order;

const setup = (overrides: Partial<Parameters<typeof ChatsTab>[0]> = {}) => {
  const props = {
    recentOrders: [order('1', 'PF-18'), order('2', 'PF-17'), order('3', 'PF-16')],
    chatThreads: { active: [thread('active')], closed: [thread('closed', 'Возврат', 'CLOSED')] },
    selectedThread: null,
    chatMessages: [],
    chatLoading: false,
    chatError: null,
    creatingSupportThread: false,
    onSelectThread: vi.fn(),
    onShowSupportStart: vi.fn(),
    onSendMessage: vi.fn(),
    onCreateSupportThread: vi.fn().mockResolvedValue(thread('created', 'Проблема с заказом')),
    ...overrides
  };
  render(<MemoryRouter><ChatsTab {...props} /></MemoryRouter>);
  return props;
};

describe('buyer chats workspace', () => {
  it('shows a useful start screen with at most two recent orders', () => {
    setup();
    expect(screen.getAllByRole('heading', { name: 'Чем помочь?' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /PF-18/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /PF-17/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /PF-16/ })).not.toBeInTheDocument();
  });

  it('starts a quick order conversation without sending a message', async () => {
    const props = setup();
    fireEvent.click(screen.getAllByRole('button', { name: /PF-18/ })[0]);
    await waitFor(() => expect(props.onCreateSupportThread).toHaveBeenCalledWith('Проблема с заказом'));
    expect(props.onSendMessage).not.toHaveBeenCalled();
    expect(props.onSelectThread).toHaveBeenCalledWith(expect.objectContaining({ id: 'created' }));
  });

  it('prefills the order context when the selected thread opens', async () => {
    const created = thread('created', 'Проблема с заказом');
    const props = {
      recentOrders: [order('1', 'PF-18')],
      chatThreads: { active: [], closed: [] },
      selectedThread: null as ChatThread | null,
      chatMessages: [],
      chatLoading: false,
      chatError: null,
      creatingSupportThread: false,
      onSelectThread: vi.fn(),
      onShowSupportStart: vi.fn(),
      onSendMessage: vi.fn(),
      onCreateSupportThread: vi.fn().mockResolvedValue(created)
    };
    const view = render(<MemoryRouter><ChatsTab {...props} /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole('button', { name: /PF-18/ })[0]);
    await waitFor(() => expect(props.onSelectThread).toHaveBeenCalled());
    view.rerender(<MemoryRouter><ChatsTab {...props} selectedThread={created} /></MemoryRouter>);
    expect(screen.getByPlaceholderText('Написать сообщение...')).toHaveValue('Вопрос по заказу PF-18: ');
    expect(props.onSendMessage).not.toHaveBeenCalled();
  });

  it.each([
    ['Оплата', 'Оплата и возврат средств'],
    ['Возврат', 'Оплата и возврат средств'],
    ['Доставка', 'Доставка'],
    ['Работа сервиса', 'Произвольный вопрос'],
    ['Другой вопрос', 'Произвольный вопрос']
  ])('uses the existing support topic for %s', async (label, value) => {
    const props = setup();
    fireEvent.click(screen.getAllByRole('button', { name: label })[0]);
    await waitFor(() => expect(props.onCreateSupportThread).toHaveBeenCalledWith(value));
  });

  it('keeps existing active and closed thread selection', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Поддержка · Доставка/ }));
    expect(props.onSelectThread).toHaveBeenCalledWith(expect.objectContaining({ id: 'active' }));
    fireEvent.click(screen.getByRole('button', { name: /Поддержка · Возврат/ }));
    expect(props.onSelectThread).toHaveBeenCalledWith(expect.objectContaining({ id: 'closed' }));
  });

  it('renders messages and sends only when the user submits', () => {
    const props = setup({ selectedThread: thread('active'), chatMessages: [{
      id: 'm1', threadId: 'active', authorRole: 'ADMIN', authorId: 'admin', text: 'Здравствуйте',
      createdAt: '2026-10-31T12:00:00Z'
    }] });
    expect(screen.getByText('Здравствуйте')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Написать сообщение...'), { target: { value: 'Мой вопрос' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(props.onSendMessage).toHaveBeenCalledWith('Мой вопрос');
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByRole('heading', { name: 'Чаты' })).toBeInTheDocument();
  });

  it('keeps the return conversation and its detail card', () => {
    const returnsThread = {
      ...thread('return'),
      returnRequest: { id: 'return-1', status: 'REQUESTED', statusLabelRu: 'На рассмотрении',
        reason: 'DAMAGED', items: [], photos: [], createdAt: '2026-10-31T12:00:00Z' }
    } as unknown as ChatThread;
    setup({ selectedThread: returnsThread });
    expect(screen.getByText('Заявка на возврат')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Заявка на возврат/ }));
    expect(screen.getByText('Детали возврата')).toBeInTheDocument();
  });

  it('prevents a second create while the first one is pending', async () => {
    let resolve!: (value: ChatThread) => void;
    const pending = new Promise<ChatThread>(r => { resolve = r; });
    const create = vi.fn().mockReturnValue(pending);
    setup({ onCreateSupportThread: create });
    fireEvent.click(screen.getAllByRole('button', { name: 'Оплата' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Возврат' })[0]);
    expect(create).toHaveBeenCalledTimes(1);
    resolve(thread('created'));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });
});
