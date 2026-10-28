import { expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CheckoutLayout } from '../features/checkout/ui/CheckoutLayout';
import { useCheckoutStore } from '../features/checkout/model/useCheckoutStore';
import { formatPrice } from '../shared/lib/formatPrice';

it('shows free delivery and charges only the 1500 RUB product after a real quote', () => {
  useCheckoutStore.setState({
    data: {
      recipient: { name: 'Buyer', phone: '+79991234567', email: '' },
      address: null,
      selectedDeliveryMethod: 'PICKUP_POINT',
      selectedPickupPoint: { provider: 'CDEK', pvzId: 'MSK123', addressFull: 'Pickup point' },
      deliveryMethods: [], paymentMethods: [], savedCards: [],
      cartItems: [{ productId: 'p1', title: 'Product', price: 150000, quantity: 1, productionTimeHours: 24 }]
    },
    deliveryAmountKopecks: 20475,
    isQuoteLoading: false,
    isLoading: false,
    error: null
  });
  useCheckoutStore.setState({ fetchCheckout: async () => {} });
  const { container } = render(<CheckoutLayout />);
  const text = (container.textContent ?? '').replace(/\s/g, ' ');
  expect(text).toContain('Доставка');
  expect(text).toContain('Бесплатно');
  expect(text).toContain('Оплата онлайн');
  expect(text.split(formatPrice(150000).replace(/\s/g, ' ')).length - 1).toBeGreaterThanOrEqual(2);
  expect(text).not.toContain(formatPrice(20475).replace(/\s/g, ' '));
});
