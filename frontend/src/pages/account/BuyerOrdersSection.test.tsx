import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Order } from '../../shared/types';
import { BuyerAccountPage } from './BuyerAccountPage';

const active = { id: 'active-1', publicNumber: 'PF-18', status: 'IN_TRANSIT', paymentStatus: 'PAID', createdAt: '2026-10-30T10:00:00Z', total: 149900, items: [{ productId: 'p1', title: 'Модель в пути', qty: 1 }] } as Order;
const completed = { ...active, id: 'done-1', publicNumber: 'PF-17', status: 'DELIVERED', deliveredToRecipientAt: '2026-10-31T10:00:00Z', items: [{ productId: 'p2', title: 'Полученная модель', qty: 1 }] } as Order;
let shownActiveOrders: Order[] = [active];

vi.mock('../../app/store/authStore', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { id: 'buyer' } }) }));
vi.mock('./hooks/useBuyerOrders', () => ({ useBuyerOrders: () => ({ activeOrders: shownActiveOrders, completedOrders: [completed], purchasedItems: [{ productId: 'p2', title: 'Полученная модель', price: 149900, orderDate: '2026-10-31T10:00:00Z', orderId: 'done-1' }], returnCandidates: [], reloadOrders: vi.fn() }) }));
vi.mock('./hooks/useMyReturns', () => ({ useMyReturns: () => ({ returns: [], isLoading: false, error: null, reload: vi.fn() }) }));
vi.mock('./hooks/useMyChats', () => ({ useMyChats: () => ({ chatThreads: [], selectedThread: null, setSelectedThread: vi.fn(), chatMessages: [], chatLoading: false, chatError: null, handleSendMessage: vi.fn(), creatingSupportThread: false, createSupportThread: vi.fn() }) }));
vi.mock('./OrdersRecommendations', () => ({ OrdersRecommendations: () => <p>Рекомендации</p> }));

describe('buyer orders section', () => {
  it('switches active and completed orders, then shows purchased goods without secondary filters', () => {
    render(<MemoryRouter initialEntries={['/account?tab=orders']}><Routes><Route path="/account" element={<BuyerAccountPage />} /></Routes></MemoryRouter>);
    expect(screen.getByText('Модель в пути')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Активные' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Завершённые' }));
    expect(screen.getByText('Полученная модель')).toBeInTheDocument();
    expect(screen.queryByText('Модель в пути')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Товары' }));
    expect(screen.queryByRole('button', { name: 'Активные' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Полученная модель/ })).toHaveAttribute('href', '/product/p2');
  });
  it('shows the empty state and recommendations for an empty active list', () => {
    shownActiveOrders = [];
    render(<MemoryRouter initialEntries={['/account?tab=orders']}><Routes><Route path="/account" element={<BuyerAccountPage />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Нет активных заказов' })).toBeInTheDocument();
    expect(screen.getByText('Рекомендации')).toBeInTheDocument();
    shownActiveOrders = [active];
  });
});
