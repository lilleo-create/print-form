import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../shared/types';
import { api } from '../../shared/api';
import { sellerProductVariantsService } from '../../shared/api/sellerProductVariantsService';
import { SellerProductModal } from './SellerProductModal';

const existing = {
  id: 'product-1', title: 'Готовая модель', descriptionShort: 'Короткое описание',
  descriptionFull: 'Подробное описание товара', description: 'Подробное описание товара',
  category: 'Декор', material: 'PLA', technology: 'FDM', color: 'Белый',
  productionTimeHours: 24, price: 150000, weightGrossG: 500,
  dxCm: 19, dyCm: 5, dzCm: 2.5, image: '/img.jpg', imageUrls: ['/img.jpg'], sku: 'PF-000001'
} as Product;

beforeEach(() => {
  vi.spyOn(api, 'getReferenceCategories').mockResolvedValue({ data: [{ id: 'cat', title: 'Декор' }] } as never);
  vi.spyOn(sellerProductVariantsService, 'list').mockResolvedValue({ data: [] } as never);
});

describe('SellerProductModal wizard', () => {
  it('advances with Enter, keeps textarea Enter, navigates back and submits the original payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SellerProductModal product={existing} onClose={vi.fn()} onSubmit={onSubmit} />);
    const title = await screen.findByDisplayValue('Готовая модель');
    expect(screen.getByText('Артикул Print-Form: PF-000001')).toBeInTheDocument();
    const description = screen.getByDisplayValue('Подробное описание товара');
    fireEvent.keyDown(description, { key: 'Enter' });
    expect(screen.getByText('Шаг 1 из 6 · Главное')).toBeInTheDocument();
    fireEvent.keyDown(title, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Шаг 2 из 6 · Характеристики')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByText('Шаг 1 из 6 · Главное')).toBeInTheDocument();
    for (let step = 0; step < 5; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
      await waitFor(() => expect(screen.getByText(`Шаг ${step + 2} из 6 · ${['Характеристики', 'Цена', 'Размеры', 'Медиа', 'Проверка'][step]}`)).toBeInTheDocument());
    }
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      id: 'product-1', title: 'Готовая модель', price: 150000, weightGrossG: 500,
      dxCm: 19, dyCm: 5, dzCm: 2.5, imageUrls: ['http://localhost:3000/img.jpg']
    });
  });
});
