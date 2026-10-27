export type CatalogFiltersState = {
  categories: string[];
  materials: string[];
  colors: string[];
  price: string;
  minRating: string;
  inStock: boolean;
};

const uniqueValues = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

export const emptyCatalogFilters = (): CatalogFiltersState => ({
  categories: [], materials: [], colors: [], price: '', minRating: '', inStock: false
});

export const toggleFilterValue = (values: string[], value: string): string[] =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

export const readFiltersFromUrl = (params: URLSearchParams): CatalogFiltersState => ({
  categories: uniqueValues(params.getAll('category')),
  materials: uniqueValues(params.getAll('material')),
  colors: uniqueValues(params.getAll('color')),
  price: params.get('price') ?? '',
  minRating: params.get('minRating') ?? '',
  inStock: params.get('inStock') === '1'
});

export const writeFiltersToUrl = (current: URLSearchParams, filters: CatalogFiltersState): URLSearchParams => {
  const params = new URLSearchParams(current);
  for (const [key, values] of [
    ['category', filters.categories], ['material', filters.materials], ['color', filters.colors]
  ] as const) {
    params.delete(key);
    uniqueValues(values).forEach((value) => params.append(key, value));
  }
  for (const [key, value] of [
    ['price', filters.price], ['minRating', filters.minRating], ['inStock', filters.inStock ? '1' : '']
  ]) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  params.delete('page');
  return params;
};

export const activeFilterGroupCount = (filters: CatalogFiltersState): number =>
  [filters.categories.length, filters.materials.length, filters.colors.length,
    filters.price.length, filters.minRating.length, Number(filters.inStock)]
    .filter(Boolean).length;
