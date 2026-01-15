import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BuyerAccountPage } from '../pages/BuyerAccountPage';
import { useOrdersStore } from '../app/store/ordersStore';
import { useAuthStore } from '../app/store/authStore';

const seedOrder = async () => {
  const createOrder = useOrdersStore.getState().createOrder;
  await createOrder(
    [
      {
        productId: 'p1',
        name: 'Тестовый товар',
        price: 1000,
        qty: 2
      }
    ],
    2000
  );
};

describe('Orders history', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useOrdersStore.setState({ orders: [] });
    useAuthStore.setState({
      user: { id: 'buyer-1', name: 'Алина Смирнова', email: 'buyer@3dmarket.ru', role: 'buyer' },
      token: 'token'
    });
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
