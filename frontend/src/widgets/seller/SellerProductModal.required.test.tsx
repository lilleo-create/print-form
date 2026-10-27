import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SellerProductModal, productSchema } from './SellerProductModal';
import { api } from '../../shared/api';

beforeEach(() => {
  vi.spyOn(api, 'getReferenceCategories').mockResolvedValue({ data: [] } as any);
});

const validForm = {
  title: 'Test product', descriptionShort: 'Short text', descriptionFull: 'Long description text',
  sku: undefined, price: '1200', material: 'PLA', category: 'Decor', technology: 'FDM',
  productionTimeHours: 24, color: 'Белый', weightGrossG: 500, dxCm: 190, dyCm: 50, dzCm: 25
};

describe('SellerProductModal required fields', () => {
  it('marks shipping fields and photo but leaves SKU optional, without a global legend', async () => {
    render(<SellerProductModal product={null} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByText('* — обязательные поля')).not.toBeInTheDocument();
    for (const name of ['Вес брутто', 'Ширина', 'Глубина', 'Высота']) {
      const label = screen.getByText(new RegExp(name)).closest('label');
      expect(label).not.toBeNull();
      expect(within(label!).getByLabelText('Обязательное поле')).toHaveTextContent('*');
    }
    const skuLabel = screen.getByText('Артикул').closest('label');
    expect(within(skuLabel!).queryByLabelText('Обязательное поле')).not.toBeInTheDocument();
    expect(screen.getByText(/Изображения и видео товара/).closest('section')).toHaveTextContent('Фото');
    expect(within(screen.getByText(/Изображения и видео товара/).closest('section')!).getByLabelText('Обязательное поле')).toBeInTheDocument();
  });

  it('blocks empty shipping fields and missing image with inline Russian errors', async () => {
    const onSubmit = vi.fn();
    render(<SellerProductModal product={null} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(screen.getByText('Укажите вес брутто (г).')).toBeInTheDocument());
    expect(screen.getByText('Укажите ширину (мм).')).toBeInTheDocument();
    expect(screen.getByText('Укажите глубину (мм).')).toBeInTheDocument();
    expect(screen.getByText('Укажите высоту (мм).')).toBeInTheDocument();
    expect(screen.getByText('Добавьте хотя бы одно изображение.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('validates positive weight and dimensions without fabricated defaults', () => {
    expect(productSchema.safeParse(validForm).success).toBe(true);
    for (const field of ['weightGrossG', 'dxCm', 'dyCm', 'dzCm'] as const) {
      expect(productSchema.safeParse({ ...validForm, [field]: undefined }).success).toBe(false);
    }
  });
});
