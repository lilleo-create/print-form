import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PackedOrderModal } from './PackedOrderModal';

afterEach(cleanup);

describe('PackedOrderModal', () => {
  it('shows the packed quote before confirming physical packing', async () => {
    const onQuote = vi.fn().mockResolvedValue({ deliveryAmountKopecks: 24700 });
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<PackedOrderModal onClose={() => undefined} onQuote={onQuote} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText('Вес с упаковкой, г'), { target: { value: '520' } });
    fireEvent.change(screen.getByLabelText('Длина, см'), { target: { value: '21.5' } });
    fireEvent.change(screen.getByLabelText('Ширина, см'), { target: { value: '14.2' } });
    fireEvent.change(screen.getByLabelText('Высота, см'), { target: { value: '11.1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать доставку' }));
    await waitFor(() => expect(screen.getByText(/Расчётная стоимость доставки: 247 ₽/)).toBeTruthy());
    expect(onQuote).toHaveBeenCalledWith({ weightGrams: 520, lengthCm: 21.5, widthCm: 14.2, heightCm: 11.1 });
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить упаковку' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(
      { weightGrams: 520, lengthCm: 21.5, widthCm: 14.2, heightCm: 11.1 }, 24700));
  });

  it('keeps entered measurements after quote failure', async () => {
    const onQuote = vi.fn().mockRejectedValue(new Error('CDEK_QUOTE_FAILED'));
    render(<PackedOrderModal onClose={() => undefined} onQuote={onQuote} onConfirm={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Вес с упаковкой, г'), { target: { value: '520' } });
    fireEvent.change(screen.getByLabelText('Длина, см'), { target: { value: '21.5' } });
    fireEvent.change(screen.getByLabelText('Ширина, см'), { target: { value: '14.2' } });
    fireEvent.change(screen.getByLabelText('Высота, см'), { target: { value: '11.1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать доставку' }));
    await waitFor(() => expect(screen.getByText(/Не удалось рассчитать доставку/)).toBeTruthy());
    expect((screen.getByLabelText('Вес с упаковкой, г') as HTMLInputElement).value).toBe('520');
    expect(screen.queryByRole('button', { name: 'Подтвердить упаковку' })).toBeNull();
  });
});
