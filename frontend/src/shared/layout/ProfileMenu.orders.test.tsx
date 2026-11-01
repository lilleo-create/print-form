import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProfileMenu } from './ProfileMenu';

vi.mock('../../app/store/authStore', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { id: 'buyer', name: 'Покупатель' } }) }));
vi.mock('../lib/useIsSeller', () => ({ useIsSeller: () => ({ isSeller: false, sellerCabinetLink: '/seller/onboarding', sellerShopLink: null }) }));
vi.mock('../lib/useSwipeToClose', () => ({ useSwipeToClose: () => ({ panelRef: { current: null }, handleTouchStart: vi.fn(), handleTouchMove: vi.fn(), handleTouchEnd: vi.fn() }) }));

describe('profile menu orders link', () => {
  it('opens the new buyer orders section and marks it active', () => {
    render(<MemoryRouter><ProfileMenu isOpen pathname="/account" searchTab="orders" onClose={vi.fn()} onLogout={vi.fn()} theme="dark" onToggleTheme={vi.fn()} /></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Заказы' });
    expect(link).toHaveAttribute('href', '/account?tab=orders');
    expect(link.className).toMatch(/profileMenuItemActive/);
  });
});
