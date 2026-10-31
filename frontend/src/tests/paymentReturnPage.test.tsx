import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaymentReturnPage } from '../pages/PaymentReturnPage';
import { ordersApi } from '../shared/api/ordersApi';
import type { Order } from '../shared/types';
import { api } from '../shared/api';

vi.mock('../shared/api/ordersApi', () => ({
  ordersApi: { getById: vi.fn() }
}));

const orderWithStatus = (paymentStatus: string): Order =>
  ({ id: 'order-123', paymentStatus, items: [] } as unknown as Order);

const renderPage = (path = '/payment/return?orderId=order-123') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PaymentReturnPage />
    </MemoryRouter>
  );

const flushRequest = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('PaymentReturnPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.spyOn(api, 'getProducts').mockResolvedValue({ data: [] } as never);
    vi.spyOn(api, 'getProduct').mockResolvedValue({ data: { category: 'Декор' } } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls a pending payment every two seconds', async () => {
    vi.useFakeTimers();
    vi.mocked(ordersApi.getById).mockResolvedValue(orderWithStatus('PENDING_PAYMENT'));
    renderPage();
    await flushRequest();
    expect(ordersApi.getById).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Проверяем оплату…')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(ordersApi.getById).toHaveBeenCalledTimes(2);
  });

  it('shows success and stops polling when pending changes to paid', async () => {
    vi.useFakeTimers();
    vi.mocked(ordersApi.getById)
      .mockResolvedValueOnce(orderWithStatus('PENDING_PAYMENT'))
      .mockResolvedValueOnce(orderWithStatus('PAID'));
    renderPage();
    await flushRequest();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('heading', { name: 'Заказ оплачен' })).toBeInTheDocument();
    expect(screen.getByText('Спасибо! Мы приняли оплату и передали заказ продавцу')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(ordersApi.getById).toHaveBeenCalledTimes(2);
  });

  it('shows success immediately for a paid order', async () => {
    vi.mocked(ordersApi.getById).mockResolvedValue(orderWithStatus('PAID'));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Заказ оплачен' })).toBeInTheDocument();
    expect(ordersApi.getById).toHaveBeenCalledTimes(1);
  });

  it('shows approved recommendations and excludes the bought product', async () => {
    const order = { ...orderWithStatus('PAID'), items: [{ productId: 'bought', sellerId: 'seller' }] } as Order;
    vi.mocked(ordersApi.getById).mockResolvedValue(order);
    vi.mocked(api.getProducts).mockResolvedValue({ data: [
      { id: 'bought', title: 'Куплен', category: 'Декор', moderationStatus: 'APPROVED', price: 1000, image: '/one.jpg' },
      { id: 'other', title: 'Другая модель', category: 'Декор', moderationStatus: 'APPROVED', price: 2000, image: '/two.jpg' }
    ] } as never);
    renderPage();
    expect(await screen.findByText('Другая модель')).toBeInTheDocument();
    expect(screen.queryByText('Куплен')).not.toBeInTheDocument();
  });

  it('keeps payment success visible when recommendations fail', async () => {
    vi.mocked(ordersApi.getById).mockResolvedValue(orderWithStatus('PAID'));
    vi.mocked(api.getProducts).mockRejectedValue(new Error('recommendations unavailable'));
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Заказ оплачен' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Перейти к заказу' })).toBeInTheDocument();
  });

  it.each([
    ['PAYMENT_EXPIRED', 'Время на оплату истекло'],
    ['CANCELLED', 'Платеж отменен']
  ])('shows %s without polling', async (status, title) => {
    vi.mocked(ordersApi.getById).mockResolvedValue(orderWithStatus(status));
    renderPage();
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.queryByText('Платеж еще обрабатывается')).not.toBeInTheDocument();
    expect(ordersApi.getById).toHaveBeenCalledTimes(1);
  });

  it('shows a clear error without orderId', async () => {
    renderPage('/payment/return');
    expect(await screen.findByText('Не указан номер заказа.')).toBeInTheDocument();
    expect(ordersApi.getById).not.toHaveBeenCalled();
  });

  it('shows a separate error when the order request fails', async () => {
    vi.mocked(ordersApi.getById).mockRejectedValue(new Error('Unauthorized'));
    renderPage();
    expect(await screen.findByText('Не удалось получить статус заказа. Попробуйте открыть заказ позже.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Заказ оплачен' })).not.toBeInTheDocument();
  });

  it('stops after fifteen attempts and explains where to check status', async () => {
    vi.useFakeTimers();
    vi.mocked(ordersApi.getById).mockResolvedValue(orderWithStatus('PENDING_PAYMENT'));
    renderPage();
    await flushRequest();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(ordersApi.getById).toHaveBeenCalledTimes(16);
    expect(screen.getByText('Платеж еще обрабатывается. Статус можно проверить в заказе.')).toBeInTheDocument();
  });

  it('does not treat an unknown status as pending or paid', async () => {
    vi.mocked(ordersApi.getById).mockResolvedValue(orderWithStatus('REFUND_PENDING'));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Статус оплаты неизвестен' })).toBeInTheDocument();
    expect(ordersApi.getById).toHaveBeenCalledTimes(1);
  });
});
