import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Order } from '../../shared/types';
import { SellerOrderListCard } from './SellerOrderListCard';
import { OrderCompactCard } from './OrderCompactCard';

const order = { id: 'order-1', publicNumber: 'PF-18', createdAt: '2026-10-30T10:00:00Z',
  status: 'PAID', paymentStatus: 'PAID', paidAt: '2026-10-30T10:00:00Z', total: 149900,
  items: [{ productId: 'product-1', title: 'Модель', qty: 1, price: 149900, sellerId: 'seller', lineTotal: 149900 }]
} as Order;

describe('order list navigation', () => {
  it('opens seller detail and keeps technical sync off the primary card', () => {
    render(<MemoryRouter initialEntries={['/seller']}><Routes><Route path="/seller" element={<SellerOrderListCard order={order} onStart={vi.fn()} onPack={vi.fn()} onShipment={vi.fn()} />} /><Route path="/seller/orders/:id" element={<h1>Seller detail</h1>} /></Routes></MemoryRouter>);
    expect(screen.queryByText(/Синхронизировать CDEK|Синхронизировать СДЭК/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link'));
    expect(screen.getByRole('heading', { name: 'Seller detail' })).toBeInTheDocument();
  });
  it('opens buyer order detail from a compact card', () => {
    render(<MemoryRouter initialEntries={['/account']}><Routes><Route path="/account" element={<OrderCompactCard order={order} />} /><Route path="/account/orders/:id" element={<h1>Buyer detail</h1>} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('link'));
    expect(screen.getByRole('heading', { name: 'Buyer detail' })).toBeInTheDocument();
  });
});
