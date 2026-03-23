import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminProductsPage } from '../pages/admin/AdminProductsPage';
import { api } from '../shared/api';

vi.mock('../shared/api', () => ({
  api: {
    getAdminProducts: vi.fn(),
    getAdminProductById: vi.fn(),
    approveAdminProduct: vi.fn(),
    rejectAdminProduct: vi.fn(),
    needsEditAdminProduct: vi.fn(),
    archiveAdminProduct: vi.fn()
  }
}));

describe('AdminProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads product details before rendering moderation modal', async () => {
    vi.mocked(api.getAdminProducts).mockResolvedValue({
      data: [
        {
          id: 'product-1',
          title: 'Test product',
          category: 'Figurines',
          price: 1500,
          image: '',
          description: '',
          material: 'PLA',
          technology: 'FDM',
          color: 'White',
          sellerId: 'seller-1',
          moderationStatus: 'PENDING'
        }
      ]
    });

    vi.mocked(api.getAdminProductById).mockResolvedValue({
      data: {
        id: 'product-1',
        title: 'Test product',
        category: 'Figurines',
        price: 1500,
        image: '',
        description: 'Full description',
        material: 'PLA',
        technology: 'FDM',
        color: 'White',
        sellerId: 'seller-1',
        moderationStatus: 'PENDING',
        moderationNotes: 'Needs review',
        seller: {
          id: 'seller-1',
          name: 'Seller name',
          email: 'seller@example.com'
        }
      }
    });

    render(<AdminProductsPage />);

    expect(await screen.findByText('Test product')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }));

    await waitFor(() => expect(api.getAdminProductById).toHaveBeenCalledWith('product-1'));

    expect(await screen.findByText('Full description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Needs review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Одобрить' })).toBeInTheDocument();
  });

  it('falls back to product list data when detail request fails', async () => {
    vi.mocked(api.getAdminProducts).mockResolvedValue({
      data: [
        {
          id: 'product-1',
          title: 'List product',
          category: 'Figurines',
          price: 1500,
          image: '',
          description: 'List description',
          material: 'PLA',
          technology: 'FDM',
          color: 'White',
          sellerId: 'seller-1',
          moderationStatus: 'PENDING',
          moderationNotes: 'List note',
          seller: {
            id: 'seller-1',
            name: 'Seller name',
            email: 'seller@example.com'
          }
        }
      ]
    });

    vi.mocked(api.getAdminProductById).mockRejectedValue(new Error('Cannot GET /admin/products/product-1'));

    render(<AdminProductsPage />);

    expect(await screen.findByText('List product')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }));

    await waitFor(() => expect(api.getAdminProductById).toHaveBeenCalledWith('product-1'));

    expect(await screen.findByText('List description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('List note')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Одобрить' })).toBeInTheDocument();
    expect(screen.queryByText('Не удалось загрузить карточку товара для модерации.')).not.toBeInTheDocument();
  });
});
