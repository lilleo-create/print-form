import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BuyerAccountPage } from '../pages/BuyerAccountPage';
import { useOrdersStore } from '../app/store/ordersStore';
import { useAuthStore } from '../app/store/authStore';

const user = { id: 'buyer-1', name: 'Покупатель', email: 'buyer@test.com', role: 'buyer' as const };

const seedOrder = async () => {
  const createOrder = useOrdersStore.getState().createOrder;
  await createOrder({
    user,
    items: [
      {
        productId: 'p1',
        name: 'Тестовый товар',
        price: 1000,
        qty: 2
      }
    ],
    total: 2000
  });
};

describe('Orders history', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useOrdersStore.setState({ orders: [] });
    useAuthStore.setState({ user, token: 'token' });
  });

  it('adds created order to history', async () => {
    await seedOrder();

    render(
      <MemoryRouter>
        <BuyerAccountPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Тестовый товар × 2')).toBeInTheDocument();
    });
  });
});
