import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PackedOrderModal } from './PackedOrderModal';

afterEach(cleanup);

describe('PackedOrderModal', () => {
  it('shows the packed quote before confirming physical packing', async () => {
    const onQuote = vi.fn().mockResolvedValue({ deliveryAmountKopecks: 24700 });
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<PackedOrderModal sellerNetBeforeDeliveryKopecks={149900} onClose={() => undefined} onQuote={onQuote} onConfirm={onConfirm} />);
    expect(screen.getByText('Укажите параметры упакованной посылки')).toBeTruthy();
    expect(screen.getAllByText(/закрытой коробки/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Подтвердить упаковку' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Вес упаковки, г'), { target: { value: '520' } });
    fireEvent.change(screen.getByLabelText('Длина, см'), { target: { value: '21.5' } });
    fireEvent.change(screen.getByLabelText('Ширина, см'), { target: { value: '14.2' } });
    fireEvent.change(screen.getByLabelText('Высота, см'), { target: { value: '11.1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать доставку' }));
    await waitFor(() => expect(screen.getByText(/Расчётная стоимость доставки: 247 ₽/)).toBeTruthy());
    expect(screen.getByText(/Покупатель доставку не оплачивает/)).toBeTruthy();
    expect(screen.getByText(/После вычета доставки/).parentElement?.textContent?.replace(/\u00a0/g, ' ')).toContain('1 252 ₽');
    expect(onQuote).toHaveBeenCalledWith({ weightGrams: 520, lengthCm: 21.5, widthCm: 14.2, heightCm: 11.1 });
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить упаковку' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(
      { weightGrams: 520, lengthCm: 21.5, widthCm: 14.2, heightCm: 11.1 }, 24700));
  });

  it('keeps entered measurements after quote failure', async () => {
    const onQuote = vi.fn().mockRejectedValue(new Error('CDEK_QUOTE_FAILED'));
    render(<PackedOrderModal sellerNetBeforeDeliveryKopecks={149900} onClose={() => undefined} onQuote={onQuote} onConfirm={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Вес упаковки, г'), { target: { value: '520' } });
    fireEvent.change(screen.getByLabelText('Длина, см'), { target: { value: '21.5' } });
    fireEvent.change(screen.getByLabelText('Ширина, см'), { target: { value: '14.2' } });
    fireEvent.change(screen.getByLabelText('Высота, см'), { target: { value: '11.1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать доставку' }));
    await waitFor(() => expect(screen.getByText(/Не удалось рассчитать доставку/)).toBeTruthy());
    expect((screen.getByLabelText('Вес упаковки, г') as HTMLInputElement).value).toBe('520');
    expect(screen.queryByRole('button', { name: 'Подтвердить упаковку' })).toBeNull();
  });

  it('shows field errors and does not quote or confirm incomplete measurements', () => {
    const onQuote = vi.fn();
    const onConfirm = vi.fn();
    render(<PackedOrderModal sellerNetBeforeDeliveryKopecks={149900} onClose={() => undefined} onQuote={onQuote} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать доставку' }));
    expect(screen.getByText('Укажите вес закрытой коробки.')).toBeTruthy();
    expect(screen.getByText('Укажите длину коробки.')).toBeTruthy();
    expect(screen.getByText('Укажите ширину коробки.')).toBeTruthy();
    expect(screen.getByText('Укажите высоту коробки.')).toBeTruthy();
    expect(onQuote).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not offer confirmation when delivery exceeds the seller amount', async () => {
    const onConfirm = vi.fn();
    render(<PackedOrderModal sellerNetBeforeDeliveryKopecks={10000}
      initial={{ weightGrams: 520, lengthCm: 21.5, widthCm: 14.2, heightCm: 11.1 }}
      onClose={() => undefined} onQuote={vi.fn().mockResolvedValue({ deliveryAmountKopecks: 24700 })}
      onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать доставку' }));
    await waitFor(() => expect(screen.getByText(/Стоимость доставки превышает сумму к выплате/)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Подтвердить упаковку' })).toHaveProperty('disabled', true);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
