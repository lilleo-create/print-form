import { describe, expect, it } from 'vitest';
import { formatModelCount } from './modelCount';

describe('Russian model count', () => {
  it.each([
    [1, '1 модель'], [2, '2 модели'], [5, '5 моделей'], [11, '11 моделей'],
    [21, '21 модель'], [22, '22 модели'], [25, '25 моделей']
  ])('formats %i', (count, expected) => {
    expect(formatModelCount(count)).toBe(expected);
  });
});
