import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FilterModal } from '../../widgets/catalog/FilterModal';
import { CatalogFiltersState, emptyCatalogFilters } from './catalogFilterState';

const Harness = () => {
  const [filters, setFilters] = useState<CatalogFiltersState>(emptyCatalogFilters);
  return <>
    <FilterModal isOpen filters={filters}
      filterOptions={{ categories: ['Decor', 'Miniatures'], materials: ['PLA', 'PETG'], colors: ['Black', 'White'] }}
      onChange={(key, value) => setFilters((previous) => ({ ...previous, [key]: value }))}
      onChangeMulti={(key, value) => setFilters((previous) => ({ ...previous, [key]: value }))}
      onToggleStock={(inStock) => setFilters((previous) => ({ ...previous, inStock }))}
      onApply={() => {}}
      onReset={() => setFilters(emptyCatalogFilters())}
      onClose={() => {}}
    />
    <output data-testid="selection">{JSON.stringify(filters)}</output>
  </>;
};

describe('FilterModal multi-select', () => {
  it('keeps PETG after removing PLA and selects two colors and categories', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('PLA'));
    fireEvent.click(screen.getByText('PETG'));
    fireEvent.click(screen.getByText('PLA'));
    fireEvent.click(screen.getByText('Black'));
    fireEvent.click(screen.getByText('White'));
    fireEvent.click(screen.getByText('Decor'));
    fireEvent.click(screen.getByText('Miniatures'));
    const selection = JSON.parse(screen.getByTestId('selection').textContent ?? '{}');
    expect(selection.materials).toEqual(['PETG']);
    expect(selection.colors).toEqual(['Black', 'White']);
    expect(selection.categories).toEqual(['Decor', 'Miniatures']);
    expect(screen.getByText('Black').className).toContain('chipColorActive');
    expect(screen.getByText('White').className).toContain('chipColorActive');
    fireEvent.click(screen.getByText('Сбросить'));
    expect(JSON.parse(screen.getByTestId('selection').textContent ?? '{}')).toEqual(emptyCatalogFilters());
  });
});
