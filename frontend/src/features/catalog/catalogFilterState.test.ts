import { describe, expect, it } from 'vitest';
import { activeFilterGroupCount, readFiltersFromUrl, toggleFilterValue, writeFiltersToUrl } from './catalogFilterState';

describe('catalog multi-select URL state', () => {
  it('adds PLA and PETG, then removes only PLA', () => {
    expect(toggleFilterValue([], 'PLA')).toEqual(['PLA']);
    expect(toggleFilterValue(['PLA'], 'PETG')).toEqual(['PLA', 'PETG']);
    expect(toggleFilterValue(['PLA', 'PETG'], 'PLA')).toEqual(['PETG']);
  });

  it('restores repeated values after refresh and preserves unrelated query values', () => {
    const initial = new URLSearchParams('q=lamp&page=3&category=Decor');
    const next = writeFiltersToUrl(initial, {
      categories: ['Decor', 'Miniatures'], materials: ['PLA', 'PETG'], colors: ['Black', 'White'],
      price: '100-200', minRating: '4', inStock: true
    });
    expect(next.get('page')).toBeNull();
    expect(next.get('q')).toBe('lamp');
    expect(next.getAll('category')).toEqual(['Decor', 'Miniatures']);
    expect(readFiltersFromUrl(new URLSearchParams(next.toString()))).toEqual({
      categories: ['Decor', 'Miniatures'], materials: ['PLA', 'PETG'], colors: ['Black', 'White'],
      price: '100-200', minRating: '4', inStock: true
    });
  });

  it('counts selected groups and reset clears all filters', () => {
    const selected = { categories: ['Decor', 'Miniatures'], materials: ['PLA', 'PETG'], colors: ['Black'], price: '', minRating: '', inStock: false };
    expect(activeFilterGroupCount(selected)).toBe(3);
    const reset = writeFiltersToUrl(new URLSearchParams('category=Decor&material=PLA&color=Black&page=4'), {
      categories: [], materials: [], colors: [], price: '', minRating: '', inStock: false
    });
    expect(reset.toString()).toBe('');
  });
});
