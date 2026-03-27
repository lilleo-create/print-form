import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProductReviewsPreview } from '../components/product/ProductReviewsPreview';
import { api } from '../shared/api';

vi.mock('../shared/api', () => ({
  api: {
    getShop: vi.fn()
  }
}));

describe('ProductReviewsPreview seller card', () => {
  it('shows neutral seller summary without alarming unavailable block when store is not public', async () => {
    vi.mocked(api.getShop).mockRejectedValue({
      status: 403,
      payload: { error: { code: 'STORE_NOT_PUBLIC', message: 'Store is not public' } }
    });

    render(
      <MemoryRouter>
        <ProductReviewsPreview
          productId="product-1"
          product={{
            id: 'product-1',
            title: 'Test product',
            category: 'Category',
            price: 1000,
            image: '/uploads/product.png',
            description: 'Description',
            material: 'PLA',
            technology: 'FDM',
            color: 'Black',
            sellerId: 'seller-1',
            sellerSummary: {
              name: 'Магазин тест',
              rating: 4.8,
              productsCount: 17,
              storeAvailable: false
            }
          } as any}
          reviews={[]}
          summary={{ total: 0, avg: 0, counts: [] }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Магазин тест')).toBeInTheDocument();
    });

    expect(screen.getByText('Рейтинг 4.8')).toBeInTheDocument();
    expect(screen.getByText('Товаров: 17')).toBeInTheDocument();
    expect(
      screen.getByText('Информация о магазине временно ограничена')
    ).toBeInTheDocument();
    expect(screen.queryByText(/недоступен/i)).not.toBeInTheDocument();
    expect(api.getShop).not.toHaveBeenCalled();
  });
});
