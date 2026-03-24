import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminProductsPage } from '../pages/admin/AdminProductsPage';
import { api } from '../shared/api';

vi.mock('../shared/api', () => ({
  api: {
    getAdminProducts: vi.fn(),
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

  it('opens moderation modal from list payload without detail fetch', async () => {
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
          moderationStatus: 'PENDING',
          moderationNotes: 'Needs review',
          seller: {
            id: 'seller-1',
            name: 'Seller name',
            email: 'seller@example.com'
          }
        }
      ]
    });

    render(<AdminProductsPage />);

    expect(await screen.findByText('Test product')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }));

    expect(await screen.findByText('Описание не заполнено.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Needs review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Одобрить' })).toBeInTheDocument();
  });

  it('sends moderation actions using selected product id from list', async () => {
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

    vi.mocked(api.approveAdminProduct).mockResolvedValue({ data: {} as never });
    vi.mocked(api.rejectAdminProduct).mockResolvedValue({ data: {} as never });
    vi.mocked(api.needsEditAdminProduct).mockResolvedValue({ data: {} as never });

    render(<AdminProductsPage />);

    expect(await screen.findByText('List product')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }));
    expect(await screen.findByText('List description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('List note')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
    await waitFor(() => expect(api.approveAdminProduct).toHaveBeenCalledWith('product-1'));

    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Need updates' } });
    fireEvent.click(screen.getByRole('button', { name: 'Нужны правки' }));
    await waitFor(() =>
      expect(api.needsEditAdminProduct).toHaveBeenCalledWith('product-1', { notes: 'Need updates' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Reject reason' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отклонить' }));
    await waitFor(() =>
      expect(api.rejectAdminProduct).toHaveBeenCalledWith('product-1', { notes: 'Reject reason' })
    );
  });
});
