import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CheckoutPage } from '../pages/CheckoutPage';
import { useCartStore } from '../app/store/cartStore';
import { useOrdersStore } from '../app/store/ordersStore';
import { useAuthStore } from '../app/store/authStore';
import { addressesApi } from '../shared/api/addressesApi';
import { contactsApi } from '../shared/api/contactsApi';

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
            color: 'Черный',
            sellerId: 'seller-1'
          },
          quantity: 2
        }
      ]
    });
    useOrdersStore.setState({ orders: [] });
    useAuthStore.setState({ user, token: 'token' });
  });

  it('creates order and clears cart', async () => {
    await contactsApi.create({ userId: user.id, name: 'Покупатель', phone: '12345', email: '' });
    const address = await addressesApi.create({
      userId: user.id,
      coords: null,
      addressText: 'Москва, Ленина, 1',
      apartment: '',
      floor: '',
      label: 'Дом',
      isFavorite: true,
      courierComment: ''
    });
    await addressesApi.setDefault(user.id, address.id);

    render(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить заказ' }));

    await waitFor(() => {
      expect(useOrdersStore.getState().orders.length).toBe(1);
    });

    expect(useCartStore.getState().items.length).toBe(0);
  });
});
