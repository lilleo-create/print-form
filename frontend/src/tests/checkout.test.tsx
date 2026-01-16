import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CheckoutPage } from '../pages/CheckoutPage';
import { useCartStore } from '../app/store/cartStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { useAuthStore } from '../app/store/authStore';

const user = { id: 'buyer-1', name: 'Покупатель', email: 'buyer@test.com', role: 'buyer' as const };

describe('Checkout flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCartStore.setState({
      items: [
        {
          product: {
            id: 'p1',
            title: 'Тестовый товар',
            category: 'Тест',
            price: 1000,
            image: 'https://example.com/img.png',
            description: 'desc',
            material: 'PLA',
            size: '10x10',
            technology: 'FDM',
            printTime: '2 часа',
            color: 'Черный'
          },
          quantity: 2
        }
      ]
    });
    useOrdersStore.setState({ orders: [] });
    useAuthStore.setState({ user, token: 'token' });
  });

  it('creates order and clears cart', async () => {
    render(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Покупатель' } });
    fireEvent.change(screen.getByLabelText('Телефон или email'), {
      target: { value: 'buyer@test.com' }
    });
    fireEvent.change(screen.getByLabelText('Адрес доставки'), {
      target: { value: 'Тестовый адрес' }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить заказ' }));

    await waitFor(() => {
      expect(useOrdersStore.getState().orders.length).toBe(1);
    });

    expect(useCartStore.getState().items.length).toBe(0);
  });
});
