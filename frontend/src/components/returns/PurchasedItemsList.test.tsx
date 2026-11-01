import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PurchasedItemsList } from './PurchasedItemsList';

describe('purchased items grid', () => {
  it('shows each bought product once even after repeat purchases', () => {
    render(<MemoryRouter><PurchasedItemsList items={[
      { productId: 'p1', title: 'Модель', price: 149900, orderDate: '2026-10-31', orderId: 'one' },
      { productId: 'p1', title: 'Модель', price: 149900, orderDate: '2026-11-01', orderId: 'two' }
    ]} /></MemoryRouter>);
    expect(screen.getAllByRole('link', { name: /Модель/ })).toHaveLength(1);
  });
});
