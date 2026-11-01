import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LegacyOrdersRedirect } from './LegacyOrdersRedirect';

const Location = () => { const location = useLocation(); return <p>{location.pathname}{location.search}</p>; };
const renderRoute = (url: string) => render(<MemoryRouter initialEntries={[url]}><Routes>
  <Route path="/orders" element={<LegacyOrdersRedirect />} />
  <Route path="/orders/:orderId" element={<LegacyOrdersRedirect />} />
  <Route path="/account" element={<Location />} />
  <Route path="/account/orders/:id" element={<Location />} />
</Routes></MemoryRouter>);

describe('legacy orders bookmarks', () => {
  it('redirects /orders to the new list', () => {
    renderRoute('/orders');
    expect(screen.getByText('/account?tab=orders')).toBeInTheDocument();
  });
  it('redirects /orders/:id to the order detail', () => {
    renderRoute('/orders/order-18');
    expect(screen.getByText('/account/orders/order-18')).toBeInTheDocument();
  });
});
