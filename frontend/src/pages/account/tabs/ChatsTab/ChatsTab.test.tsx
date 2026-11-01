import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ChatThread, Order } from '../../../../shared/types';
import { ChatsTab } from './ChatsTab';

const thread = (id: string, topic = 'Доставка', status: ChatThread['status'] = 'ACTIVE') =>
  ({ id, kind: 'SUPPORT', userId: 'buyer', status, supportTopic: topic, createdAt: '2026-10-31T12:00:00Z' }) as ChatThread;
const order = (id: string, number: string, status = 'PAID') =>
  ({ id, publicNumber: number, status, paymentStatus: 'PAID', paidAt: '2026-10-31T12:00:00Z',
    createdAt: '2026-10-31T12:00:00Z', items: [{ productId: id, title: `Товар ${number}`, qty: 1 }] }) as Order;

const setup = (overrides: Partial<Parameters<typeof ChatsTab>[0]> = {}) => {
  const props = {
    recentOrders: [order('1', 'PF-18'), order('2', 'PF-17'), order('3', 'PF-16')],
    chatThreads: { active: [thread('active')], closed: [thread('closed', 'Возврат', 'CLOSED')] },
    selectedThread: null as ChatThread | null,
    chatMessages: [],
    chatLoading: false,
    chatError: null,
    creatingSupportThread: false,
    onSelectThread: vi.fn(),
    onShowSupportStart: vi.fn(),
    onSendMessage: vi.fn(),
    onSubmitSupportQuestion: vi.fn().mockResolvedValue(true),
    onSubmitQuickQuestion: vi.fn().mockResolvedValue(true),
    ...overrides
  };
  const view = render(<MemoryRouter><ChatsTab {...props} /></MemoryRouter>);
  return { props, view };
};

describe('buyer support bot flow', () => {
  it('represents an active ordinary support thread only in the main support entry', () => {
    setup({ selectedThread: thread('active'), chatThreads: { active: [thread('active')], closed: [] } });
    expect(screen.queryByText('Здравствуйте! С чем помочь?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Поддержка Print-Form Поможем/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Поддержка · Доставка/ })).not.toBeInTheDocument();
  });
  it('opens the support chat with two orders, a composer, and no global close control', () => {
    const { props } = setup();
    expect(screen.getByText('Здравствуйте! С чем помочь?')).toBeInTheDocument();
    expect(screen.queryByText(/Сообщение отправится только после/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PF-18/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PF-17/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /PF-16/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Оплата' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Напишите ваш вопрос...')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Чаты' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Закрыть чаты' })).not.toBeInTheDocument();
    expect(props.onSubmitSupportQuestion).not.toHaveBeenCalled();
    expect(screen.queryByText('Мои диалоги')).not.toBeInTheDocument();
    expect(screen.queryByText('Активные')).not.toBeInTheDocument();
    expect(screen.queryByText('Завершённые')).not.toBeInTheDocument();
    expect(screen.queryByText('Нет чатов.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Показать архив/ })).toBeInTheDocument();
    expect(screen.getByText('Здравствуйте! С чем помочь?').closest('[class*="flowContent"]')).toBeInTheDocument();
  });

  it('opens archived threads in a separate local left-panel view and returns', () => {
    const { props } = setup();
    expect(screen.queryByRole('button', { name: /Поддержка · Возврат/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Показать архив/ }));
    expect(screen.getAllByRole('heading', { name: 'Архив' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Вернуться к чатам' }).querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Вернуться к чатам' })).not.toHaveTextContent('←');
    expect(screen.queryByText('← Назад')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Поддержка · Возврат/ }));
    expect(props.onSelectThread).toHaveBeenCalledWith(expect.objectContaining({ id: 'closed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Вернуться к чатам' }));
    expect(screen.getByRole('button', { name: /Показать архив/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Архив' })).not.toBeInTheDocument();
  });

  it('shows a small empty archive message', () => {
    setup({ chatThreads: { active: [], closed: [] } });
    fireEvent.click(screen.getByRole('button', { name: /Показать архив/ }));
    expect(screen.getByText('В архиве пока ничего нет')).toBeInTheDocument();
    expect(screen.queryByText('Нет чатов.')).not.toBeInTheDocument();
  });

  it('shows order questions without creating a thread or sending', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: /PF-18/ }));
    expect(screen.getByText('Что хотите уточнить по заказу PF-18?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Когда придёт/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Оплата' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Напишите ваш вопрос...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Другой заказ / тема' })).toBeInTheDocument();
    expect(props.onSubmitSupportQuestion).not.toHaveBeenCalled();
  });

  it('hides arrival questions for an already delivered order', () => {
    setup({ recentOrders: [order('done', 'PF-17', 'DELIVERED')] });
    fireEvent.click(screen.getByRole('button', { name: /PF-17/ }));
    expect(screen.queryByRole('button', { name: /Когда придёт/ })).not.toBeInTheDocument();
  });

  it('shows delivery subcategories without creating a thread', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Доставка' }));
    expect(screen.getByText('Что хотите уточнить о доставке?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Срок доставки/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Напишите ваш вопрос...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Изменить тему' })).toBeInTheDocument();
    expect(props.onSubmitSupportQuestion).not.toHaveBeenCalled();
  });

  it.each([
    ['Оплата', 'Что произошло с оплатой?', 'Оплата не проходит'],
    ['Возврат', 'Что хотите узнать о возврате?', 'Статус возврата'],
    ['Работа сервиса', 'С чем возник вопрос?', 'Ошибка на сайте']
  ])('shows %s questions', (category, prompt, option) => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: category }));
    expect(screen.getByText(prompt)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(option) })).toBeInTheDocument();
  });

  it('opens an empty editable composer for another question', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Другой вопрос' }));
    const input = screen.getByPlaceholderText('Напишите ваш вопрос...');
    expect(input).toHaveValue('');
    fireEvent.change(input, { target: { value: 'Мой вопрос' } });
    expect(input).toHaveValue('Мой вопрос');
    expect(screen.getByText('Здравствуйте! С чем помочь?')).toBeInTheDocument();
    expect(props.onSubmitSupportQuestion).not.toHaveBeenCalled();
  });

  it('sends a final payment question directly through the persisted quick action', async () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Оплата' }));
    fireEvent.click(screen.getByRole('button', { name: /Деньги списались/ }));
    await waitFor(() => expect(props.onSubmitQuickQuestion).toHaveBeenCalledWith('Оплата и возврат средств', 'Деньги списались, но заказ не отображается как оплаченный.'));
    expect(props.onSubmitSupportQuestion).not.toHaveBeenCalled();
    expect(props.onSubmitQuickQuestion).toHaveBeenCalledTimes(1);
  });

  it('sends an order question with the actual order number', async () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: /PF-18/ }));
    fireEvent.click(screen.getByRole('button', { name: /Когда придёт/ }));
    await waitFor(() => expect(props.onSubmitQuickQuestion).toHaveBeenCalledWith('Проблема с заказом', 'Когда придёт заказ PF-18?'));
  });

  it('sends a delivery leaf directly and does not change the manual composer', async () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Доставка' }));
    fireEvent.click(screen.getByRole('button', { name: 'Срок доставки' }));
    await waitFor(() => expect(props.onSubmitQuickQuestion).toHaveBeenCalledWith('Доставка', 'Хочу уточнить срок доставки.'));
    expect(screen.getByPlaceholderText('Напишите ваш вопрос...')).toHaveValue('');
  });

  it('guards a quick question against a second click while sending', async () => {
    let resolveSend!: (sent: boolean) => void;
    const onSubmitQuickQuestion = vi.fn().mockReturnValue(new Promise<boolean>(resolve => { resolveSend = resolve; }));
    setup({ onSubmitQuickQuestion });
    fireEvent.click(screen.getByRole('button', { name: 'Доставка' }));
    const leaf = screen.getByRole('button', { name: 'Срок доставки' });
    fireEvent.click(leaf);
    fireEvent.click(leaf);
    expect(onSubmitQuickQuestion).toHaveBeenCalledTimes(1);
    await act(async () => { resolveSend(true); });
  });

  it('keeps quick choices and shows an error if their send fails', async () => {
    const { props } = setup({ onSubmitQuickQuestion: vi.fn().mockResolvedValue(false) });
    fireEvent.click(screen.getByRole('button', { name: 'Доставка' }));
    fireEvent.click(screen.getByRole('button', { name: 'Срок доставки' }));
    await waitFor(() => expect(props.onSubmitQuickQuestion).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Срок доставки' })).toBeInTheDocument();
  });

  it('changes the topic using a quick command in the options row', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Доставка' }));
    expect(screen.queryByRole('button', { name: 'Изменить' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Изменить тему' }));
    expect(screen.getByText('Здравствуйте! С чем помочь?')).toBeInTheDocument();
  });

  it('sends a directly typed question with the generic support topic', async () => {
    const { props } = setup();
    const input = screen.getByPlaceholderText('Напишите ваш вопрос...');
    fireEvent.change(input, { target: { value: 'Помогите разобраться' } });
    expect(props.onSubmitSupportQuestion).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await waitFor(() => expect(props.onSubmitSupportQuestion).toHaveBeenCalledWith('Произвольный вопрос', { text: 'Помогите разобраться' }));
    expect(props.onSubmitSupportQuestion).toHaveBeenCalledTimes(1);
  });

  it('keeps composer usable while choosing an order or category', async () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: /PF-18/ }));
    fireEvent.change(screen.getByPlaceholderText('Напишите ваш вопрос...'), { target: { value: 'Вопрос по заказу' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await waitFor(() => expect(props.onSubmitSupportQuestion).toHaveBeenCalledWith('Проблема с заказом', { text: 'Вопрос по заказу' }));
  });

  it('returns from a mobile archived conversation to archive list, then main chats', () => {
    const closed = thread('closed', 'Возврат', 'CLOSED');
    const { props, view } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'К списку чатов' }));
    fireEvent.click(screen.getByRole('button', { name: /Показать архив/ }));
    fireEvent.click(screen.getByRole('button', { name: /Поддержка · Возврат/ }));
    view.rerender(<MemoryRouter><ChatsTab {...props} selectedThread={closed} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByRole('heading', { name: 'Архив' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Вернуться к чатам' }));
    expect(screen.getByRole('heading', { name: 'Чаты' })).toBeInTheDocument();
    expect(props.onShowSupportStart).toHaveBeenCalledTimes(1);
  });

  it('opens existing threads directly with messages and return details', () => {
    const returnsThread = {
      ...thread('return'), returnRequest: { id: 'return-1', status: 'REQUESTED',
        statusLabelRu: 'На рассмотрении', reason: 'DAMAGED', items: [], photos: [],
        createdAt: '2026-10-31T12:00:00Z' }
    } as unknown as ChatThread;
    const sellerThread = { ...thread('active'), kind: 'SELLER' as const };
    const { props, view } = setup({ chatThreads: { active: [sellerThread], closed: [] } });
    fireEvent.click(screen.getByRole('button', { name: /Продавец/ }));
    expect(props.onSelectThread).toHaveBeenCalledWith(expect.objectContaining({ id: 'active' }));
    view.rerender(<MemoryRouter><ChatsTab {...props} selectedThread={returnsThread} chatMessages={[{
      id: 'm1', threadId: 'return', authorRole: 'ADMIN', authorId: 'admin',
      text: 'Здравствуйте', createdAt: '2026-10-31T12:00:00Z'
    }]} /></MemoryRouter>);
    expect(screen.getByText('Здравствуйте')).toBeInTheDocument();
    expect(screen.getByText('Заявка на возврат')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Заявка на возврат/ }));
    expect(screen.getByText('Детали возврата')).toBeInTheDocument();
    expect(props.onSubmitSupportQuestion).not.toHaveBeenCalled();
  });

  it('keeps grouped support/user bubbles, a date separator, and a closed read-only chat', () => {
    const closed = thread('closed', 'Доставка', 'CLOSED');
    const now = new Date().toISOString();
    setup({ selectedThread: closed, chatMessages: [
      { id: 'a', threadId: 'closed', authorRole: 'ADMIN', authorId: 'admin', text: 'Первый ответ', createdAt: now },
      { id: 'b', threadId: 'closed', authorRole: 'ADMIN', authorId: 'admin', text: 'Второй ответ', createdAt: now },
      { id: 'c', threadId: 'closed', authorRole: 'USER', authorId: 'buyer', text: 'Спасибо', createdAt: now }
    ] });
    expect(screen.getByText('Первый ответ').closest('[class*="messageAdmin"]')).toBeInTheDocument();
    expect(screen.getByText('Спасибо').closest('[class*="messageUser"]')).toBeInTheDocument();
    expect(screen.getAllByText('Поддержка Print-Form')).toHaveLength(2);
    expect(screen.getByText('Сегодня')).toBeInTheDocument();
    expect(screen.getByText('Диалог завершён')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Написать сообщение...')).not.toBeInTheDocument();
  });

  it('keeps sending from an existing active thread', async () => {
    const { props } = setup({ selectedThread: thread('active') });
    fireEvent.change(screen.getByPlaceholderText('Написать сообщение...'), { target: { value: 'Где заказ?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await waitFor(() => expect(props.onSendMessage).toHaveBeenCalledWith({ text: 'Где заказ?' }));
    expect(props.onSubmitSupportQuestion).not.toHaveBeenCalled();
  });

  it('uses the support entry to restart the local flow and mobile back to show the list', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Оплата' }));
    fireEvent.click(screen.getByRole('button', { name: 'К списку чатов' }));
    fireEvent.click(screen.getByRole('button', { name: /Поддержка Print-Form Поможем/ }));
    expect(props.onShowSupportStart).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Здравствуйте! С чем помочь?')).toBeInTheDocument();
  });
});
