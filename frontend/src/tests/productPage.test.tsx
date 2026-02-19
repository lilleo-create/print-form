import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { ProductPage } from '../pages/ProductPage';

vi.mock('../shared/api', () => ({
  api: {
    getProduct: vi.fn().mockResolvedValue({
      data: {
        id: 'p1',
        title: 'Тестовый продукт',
        category: 'Гаджеты',
        price: 1200,
        image: 'image.jpg',
        description: 'Описание',
        material: 'PLA',
        technology: 'FDM',
        printTime: '2 часа',
        color: 'Черный',
        sellerId: 'seller-1',
        ratingAvg: 4.5,
        ratingCount: 12
      }
    }),
    getProductReviews: vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } }),
    getReviewSummary: vi.fn().mockResolvedValue({ data: { total: 0, avg: 0, counts: [], photos: [] } }),
    getProducts: vi.fn().mockResolvedValue({ data: [] }),
    createReview: vi.fn()
  }
}));

vi.mock('../app/store/cartStore', () => ({
  useCartStore: () => ({
    addItem: vi.fn()
  })
}));

vi.mock('../app/store/authStore', () => ({
  useAuthStore: () => ({
    user: null
  })
}));

describe('ProductPage', () => {
  it('renders product details', async () => {
    render(
      <MemoryRouter initialEntries={['/product/p1']}>
        <Routes>
          <Route path="/product/:id" element={<ProductPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Тестовый продукт')).toBeInTheDocument());
    expect(screen.getByText(/Ближайшая дата доставки/i)).toBeInTheDocument();
  });
});
