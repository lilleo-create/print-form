import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '../shared/types';
import { ordersApi } from '../shared/api/ordersApi';
import { SellerOrderDetailPage } from './SellerOrderDetailPage';
import { BuyerOrderDetailPage } from './BuyerOrderDetailPage';

vi.mock('../app/store/authStore', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { id: 'seller-1' } }) }));
vi.mock('../shared/api/ordersApi', () => ({ ordersApi: { getById: vi.fn(), listBySeller: vi.fn(), readyToShip: vi.fn() } }));

const order = { id: 'order-18', publicNumber: 'PF-18', status: 'READY_FOR_SHIPMENT',
  paymentStatus: 'PAID', paidAt: '2026-10-30T12:00:00Z', createdAt: '2026-10-30T11:00:00Z',
  total: 149900, cdekOrderId: 'cdek-uuid', trackingNumber: 'TRACK-1', dropoffDeadlineAt: '2026-10-31T12:00:00Z',
  items: [{ id: 'item-1', productId: 'product-1', title: 'Модель', qty: 1, price: 149900, sellerId: 'seller-1', lineTotal: 149900 }],
  financials: { itemsSubtotal: 149900, total: 149900, sellerNetAmount: 149900, sellerNetAfterDeliveryAmount: 128245,
    platformFeeAmount: 0, acquiringFeeAmount: 0, cdekBaseDeliveryAmount: 20475, cdekAdditionalServicesAmount: 1180, cdekCurrentTotalAmount: 21655 },
  shipment: { id: 'shipment-1', status: 'READY_TO_SHIP', readbackStatus: 'PENDING' }
} as unknown as Order;

beforeEach(() => {
  vi.mocked(ordersApi.getById).mockResolvedValue(order);
  vi.mocked(ordersApi.listBySeller).mockResolvedValue([order]);
});

describe('order detail pages', () => {
  it('shows seller handoff, timeline and provider cost without a new create action', async () => {
    render(<MemoryRouter initialEntries={['/seller/orders/order-18']}><Routes><Route path="/seller/orders/:id" element={<SellerOrderDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'PF-18' })).toBeInTheDocument();
    expect(screen.getAllByText('Заявка создана в CDEK, подтверждаем данные').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Передайте заказ в CDEK' })).toBeInTheDocument();
    expect(screen.getByText(/Сдать до:/)).toBeInTheDocument();
    expect(screen.getByText('Доп. услуги CDEK')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать доставку в CDEK' })).not.toBeInTheDocument();
    expect(screen.queryByText('Синхронизировать CDEK')).not.toBeInTheDocument();
  });
  it('shows buyer timeline, free delivery and existing product actions', async () => {
    render(<MemoryRouter initialEntries={['/account/orders/order-18']}><Routes><Route path="/account/orders/:id" element={<BuyerOrderDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'PF-18' })).toBeInTheDocument();
    expect(screen.getByText('Бесплатно')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Купить ещё раз' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Этапы заказа' })).toBeInTheDocument();
  });
});
