import { describe, expect, it } from 'vitest';
import { mmToCm } from '../shared/lib/productDimensions';

describe('product dimension payload conversion', () => {
  it('preserves millimetre precision when serializing centimetres', () => {
    expect(mmToCm(55)).toBe(5.5);
    expect(mmToCm(123)).toBe(12.3);
    expect(mmToCm(10)).toBe(1);
    expect(mmToCm(1)).toBe(0.1);
  });
});
