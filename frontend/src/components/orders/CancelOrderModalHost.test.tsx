import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { CancelOrderModalHost } from './CancelOrderModalHost';
import { ordersApi } from '../../shared/api/ordersApi';

vi.mock('../../shared/api/ordersApi', () => ({ ordersApi: { cancelMyOrder: vi.fn() } }));
vi.mock('../../app/store/authStore', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { id: 'buyer-1' } }) }));
vi.mock('../../app/store/ordersStore', () => ({ useOrdersStore: (selector: (state: unknown) => unknown) => selector({ loadBuyerOrders: vi.fn() }) }));

it('keeps cancellation dialog open and shows an error when refund creation fails', async () => {
  vi.mocked(ordersApi.cancelMyOrder).mockRejectedValue(new Error('REFUND_CREATE_FAILED'));
  render(<MemoryRouter initialEntries={['/cancel?orderId=order-1']}><CancelOrderModalHost /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Отменить заказ' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Не удалось отменить заказ'));
  expect(screen.getByRole('heading', { name: 'Отмена заказа' })).toBeInTheDocument();
});
