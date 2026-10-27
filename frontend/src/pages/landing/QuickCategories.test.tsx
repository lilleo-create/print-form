import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QuickCategories } from './QuickCategories';
import { api } from '../../shared/api';

const CatalogLocation = () => {
  const location = useLocation();
  return <output data-testid="catalog-url">{location.pathname + location.search}</output>;
};

afterEach(() => vi.restoreAllMocks());

describe('QuickCategories', () => {
  it('shows API counts and opens the catalog with the title query', async () => {
    vi.spyOn(api, 'getReferenceCategoriesWithCounts').mockResolvedValue({ data: [
      { id: 'one', slug: 'decor', title: 'Декор', productsCount: 2 },
      { id: 'two', slug: 'new-category', title: 'Новая категория', productsCount: 0 }
    ] } as any);
    render(<MemoryRouter initialEntries={['/']}><Routes>
      <Route path="/" element={<QuickCategories />} />
      <Route path="/catalog" element={<CatalogLocation />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText('2 модели')).toBeInTheDocument();
    expect(screen.getByText('0 моделей')).toBeInTheDocument();
    expect(screen.queryByText('188 моделей')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Декор'));
    await waitFor(() => expect(screen.getByTestId('catalog-url')).toHaveTextContent('/catalog?category=%D0%94%D0%B5%D0%BA%D0%BE%D1%80'));
  });

  it('does not display fabricated counts when the counts endpoint fails', async () => {
    vi.spyOn(api, 'getReferenceCategoriesWithCounts').mockRejectedValue(new Error('offline'));
    vi.spyOn(api, 'getReferenceCategories').mockResolvedValue({ data: [
      { id: 'one', slug: 'decor', title: 'Декор' }
    ] } as any);
    render(<MemoryRouter><QuickCategories /></MemoryRouter>);
    expect(await screen.findByText('Декор')).toBeInTheDocument();
    expect(screen.queryByText(/\d+ моделей/)).not.toBeInTheDocument();
  });
});
