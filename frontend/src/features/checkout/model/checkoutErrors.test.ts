import { describe, expect, it } from 'vitest';
import { checkoutErrorMessage } from './checkoutErrors';

describe('checkout validation copy', () => {
  it.each([
    ['PRODUCT_NOT_FOUND', 'Товар больше недоступен'],
    ['PRODUCT_PRICE_CHANGED', 'Цена товара изменилась'],
    ['VARIANT_INVALID', 'вариант больше недоступен'],
    ['PVZ_INVALID', 'пункт выдачи']
  ])('maps %s to a human message', (code, excerpt) => {
    expect(checkoutErrorMessage({ status: 400, payload: { error: { code } } })).toContain(excerpt);
  });
  it('does not show raw server errors', () => {
    expect(checkoutErrorMessage(new Error('SQL internal detail'))).not.toContain('SQL');
  });
});
