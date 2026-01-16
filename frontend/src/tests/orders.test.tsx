import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BuyerAccountPage } from '../pages/BuyerAccountPage';
import { useOrdersStore } from '../app/store/ordersStore';
import { useAuthStore } from '../app/store/authStore';
import { addressesApi } from '../shared/api/addressesApi';
import { contactsApi } from '../shared/api/contactsApi';

const user = { id: 'buyer-1', name: 'Покупатель', email: 'buyer@test.com', role: 'buyer' as const };

describe('Orders history', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useOrdersStore.setState({ orders: [] });
    useAuthStore.setState({ user, token: 'token' });
  });

  it('adds created order to history', async () => {
    const contact = await contactsApi.create({ userId: user.id, name: 'Покупатель', phone: '123', email: '' });
    const address = await addressesApi.create({
      userId: user.id,
      label: 'Дом',
      city: 'Москва',
      street: 'Ленина',
      house: '1',
      apt: '',
      comment: ''
    });

    const createOrder = useOrdersStore.getState().createOrder;
    await createOrder({
      user,
      contactId: contact.id,
      shippingAddressId: address.id,
      items: [
        {
          productId: 'p1',
          title: 'Тестовый товар',
          price: 1000,
          qty: 2,
          sellerId: 'seller-1',
          lineTotal: 2000
        }
      ],
      total: 2000
    });

    render(
      <MemoryRouter>
        <BuyerAccountPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Тестовый товар')).toBeInTheDocument();
      expect(screen.getByText(/1\s?000 ₽ · 2 шт\./)).toBeInTheDocument();
    });
  });
});
