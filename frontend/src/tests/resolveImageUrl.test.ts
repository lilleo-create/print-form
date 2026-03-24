import { describe, expect, it } from 'vitest';
import { resolveImageUrl } from '../shared/lib/resolveImageUrl';

describe('resolveImageUrl', () => {
  it('resolves root-relative uploads path using window origin', () => {
    expect(resolveImageUrl('/uploads/product.png')).toBe('http://localhost:3000/uploads/product.png');
  });

  it('resolves relative uploads path without leading slash', () => {
    expect(resolveImageUrl('uploads/product.png')).toBe('http://localhost:3000/uploads/product.png');
  });

  it('returns absolute urls as-is', () => {
    expect(resolveImageUrl('https://cdn.example.com/image.png')).toBe('https://cdn.example.com/image.png');
  });

  it('returns empty string for empty values', () => {
    expect(resolveImageUrl('')).toBe('');
    expect(resolveImageUrl('   ')).toBe('');
    expect(resolveImageUrl(null)).toBe('');
    expect(resolveImageUrl(undefined)).toBe('');
  });

  it('returns empty string for malformed absolute url instead of throwing', () => {
    expect(() => resolveImageUrl('https://')).not.toThrow();
    expect(resolveImageUrl('https://')).toBe('');
  });
});
