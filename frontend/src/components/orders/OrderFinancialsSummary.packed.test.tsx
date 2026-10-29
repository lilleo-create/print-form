import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OrderFinancialsSummary } from './OrderFinancialsSummary';

afterEach(cleanup);

const financials = {
  itemsSubtotal: 149900, deliveryAmount: 0, total: 149900, platformFeePercent: 0,
  platformFeeAmount: 0, sellerNetAmount: 149900, currency: 'RUB',
  checkoutDeliveryEstimateAmount: 20475, packedDeliveryAmount: null,
  confirmedActualDeliveryAmount: null, sellerNetAfterDeliveryAmount: 129425
};

it('shows checkout estimate as seller expense and does not call an unpaid order paid', () => {
  render(<OrderFinancialsSummary financials={financials} isPaid={false} />);
  expect(screen.getByText('Сумма заказа')).toBeTruthy();
  expect(screen.getByText(/Ориентировочная доставка/)).toBeTruthy();
  expect(screen.getByText(/Ориентир. после доставки/)).toBeTruthy();
  expect(screen.queryByText('Итого оплачено')).toBeNull();
});

it('switches from packed quote to authoritative actual cost', () => {
  const packed = { ...financials, packedDeliveryAmount: 24700, sellerNetAfterDeliveryAmount: 125200 };
  const { rerender } = render(<OrderFinancialsSummary financials={packed} isPaid />);
  expect(screen.getByText(/Расчётная доставка/)).toBeTruthy();
  rerender(<OrderFinancialsSummary financials={{ ...packed, confirmedActualDeliveryAmount: 26100,
    sellerNetAfterDeliveryAmount: 123800 }} isPaid />);
  expect(screen.getByText(/Фактическая доставка/)).toBeTruthy();
  expect(screen.getByText('Итого продавцу')).toBeTruthy();
});
