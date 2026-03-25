import { describe, expect, it } from 'vitest';
import { sanitizeVariantPayload } from '../shared/api/sellerProductVariantsService';

describe('sanitizeVariantPayload', () => {
  it('removes empty sku from payload', () => {
    const payload = sanitizeVariantPayload({
      name: 'Variant 1',
      sku: '   ',
      stock: 10,
    });

    expect(payload).toEqual({
      name: 'Variant 1',
      stock: 10,
    });
    expect('sku' in payload).toBe(false);
  });

  it('keeps non-empty sku trimmed', () => {
    const payload = sanitizeVariantPayload({
      name: 'Variant 2',
      sku: '  SKU-42  ',
    });

    expect(payload).toEqual({
      name: 'Variant 2',
      sku: 'SKU-42',
    });
  });
});
