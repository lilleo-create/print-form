import type { Product } from '../types';
import { buildFallbackProductSpecs, normalizeProductDto, type ProductSpecLike } from './normalizeProductDto';

type RawSpec = ProductSpecLike;

const takeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';

const mapPairs = (list: RawSpec[]) =>
  list
    .map((item) => ({
      name: takeText(item.name ?? item.key ?? item.title ?? item.label),
      value: takeText(item.value)
    }))
    .filter((item) => item.name && item.value);

const dedupeByNameValue = (list: Array<{ name: string; value: string }>) => {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = `${item.name.toLowerCase()}::${item.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const normalizeProductSpecs = (product: Product | null): Array<{ name: string; value: string }> => {
  if (!product) return [];

  const normalized = normalizeProductDto(product);
  if (!normalized) return [];

  const fromSpecs = mapPairs(normalized.specs);
  if (fromSpecs.length > 0) return dedupeByNameValue(fromSpecs);

  const fromSpecifications = mapPairs(normalized.specifications);
  if (fromSpecifications.length > 0) return dedupeByNameValue(fromSpecifications);

  const fromCharacteristics = mapPairs(normalized.characteristics);
  if (fromCharacteristics.length > 0) return dedupeByNameValue(fromCharacteristics);

  const fromFallback = normalized.derivedCharacteristics.length
    ? normalized.derivedCharacteristics
    : buildFallbackProductSpecs(normalized);

  return dedupeByNameValue(fromFallback);
};
