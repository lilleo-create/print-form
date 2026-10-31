import { describe, expect, it } from 'vitest';
import { sanitizeVariantPayload } from '../shared/api/sellerProductVariantsService';

describe('sanitizeVariantPayload', () => {
  it('never transmits a stale manually entered article', () => {
    const payload = sanitizeVariantPayload({
      name: 'Variant 1',
      sku: 'SKU-42',
      stock: 10,
    } as any);

    expect(payload).toEqual({
      name: 'Variant 1',
      stock: 10,
    });
    expect('sku' in payload).toBe(false);
  });

  it('keeps ordinary variant fields', () => {
    const payload = sanitizeVariantPayload({
      name: 'Variant 2',
      options: { color: ['White'] },
    });

    expect(payload).toEqual({
      name: 'Variant 2',
      options: { color: ['White'] },
    });
  });
});
