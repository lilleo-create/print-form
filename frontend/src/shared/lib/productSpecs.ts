import type { Product } from '../types';

type RawSpec = { key?: string; name?: string; title?: string; label?: string; value?: string | number | null };

const takeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';

const mapPairs = (list: RawSpec[]) =>
  list
    .map((item) => ({
      name: takeText(item.name ?? item.key ?? item.title ?? item.label),
      value: takeText(item.value)
    }))
    .filter((item) => item.name && item.value);

export const normalizeProductSpecs = (product: Product | null): Array<{ name: string; value: string }> => {
  if (!product) return [];

  const fromSpecs = Array.isArray(product.specs)
    ? mapPairs(product.specs.map((spec) => ({ key: spec.key, value: spec.value })))
    : [];
  if (fromSpecs.length > 0) return fromSpecs;

  const fromCharacteristics = (product as Product & { characteristics?: RawSpec[] | Record<string, unknown> }).characteristics;
  if (Array.isArray(fromCharacteristics)) {
    const list = mapPairs(fromCharacteristics);
    if (list.length > 0) return list;
  }

  if (fromCharacteristics && typeof fromCharacteristics === 'object') {
    const list = Object.entries(fromCharacteristics)
      .map(([name, value]) => ({ name: takeText(name), value: takeText(value) }))
      .filter((item) => item.name && item.value);
    if (list.length > 0) return list;
  }

  const fromAttributes = (product as Product & { attributes?: RawSpec[] }).attributes;
  if (Array.isArray(fromAttributes)) {
    const list = mapPairs(fromAttributes);
    if (list.length > 0) return list;
  }

  return [];
};

