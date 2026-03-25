import type { Product } from '../types';

type ProductRecord = Product & Record<string, unknown>;

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const pickFirstString = (source: ProductRecord, keys: string[]): string | null => {
  for (const key of keys) {
    const direct = readString(source[key]);
    if (direct) return direct;
  }

  const meta = source.meta;
  if (meta && typeof meta === 'object') {
    for (const key of keys) {
      const nested = readString((meta as Record<string, unknown>)[key]);
      if (nested) return nested;
    }
  }

  return null;
};

export const getProductGroupKey = (product: Product): string | null => {
  const record = product as ProductRecord;
  const groupId = pickFirstString(record, [
    'variantGroupId',
    'variant_group_id',
    'groupId',
    'productGroupId',
    'product_group_id'
  ]);
  if (groupId) return `group:${groupId}`;

  const baseId = pickFirstString(record, [
    'baseProductId',
    'base_product_id',
    'parentProductId',
    'parent_product_id'
  ]);

  if (baseId) return `base:${baseId}`;

  return null;
};

export const getProductParentId = (product: Product): string | null => {
  const record = product as ProductRecord;
  return pickFirstString(record, [
    'baseProductId',
    'base_product_id',
    'parentProductId',
    'parent_product_id'
  ]);
};

const getDisplayPriority = (product: Product): number => {
  const record = product as ProductRecord;
  const isBase = Boolean(record.isBaseProduct) || record.isVariant === false;
  if (isBase) return 0;
  return getProductParentId(product) ? 2 : 1;
};

export const getProductVariants = (product: Product, products: Product[]): Product[] => {
  const key = getProductGroupKey(product);
  if (!key) return [product];

  return products
    .filter((item) => getProductGroupKey(item) === key)
    .sort((a, b) => getDisplayPriority(a) - getDisplayPriority(b));
};

export const groupCatalogProducts = (products: Product[]): Product[] => {
  const grouped = new Map<string, Product[]>();
  const singles: Product[] = [];

  for (const product of products) {
    const key = getProductGroupKey(product);
    if (!key) {
      singles.push(product);
      continue;
    }
    const bucket = grouped.get(key);
    if (bucket) bucket.push(product);
    else grouped.set(key, [product]);
  }

  const merged = Array.from(grouped.values()).map((items) => {
    const sorted = [...items].sort((a, b) => getDisplayPriority(a) - getDisplayPriority(b));
    return {
      ...sorted[0],
      variantProducts: sorted
    } satisfies Product;
  });

  return [...singles, ...merged];
};
