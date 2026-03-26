import type { Product, ProductImage, ProductSpec, ProductVariant } from '../types';

export type ProductSpecLike = ProductSpec & {
  name?: string;
  title?: string;
  label?: string;
};

type ProductWithLegacyFields = Product & {
  media?: unknown;
  gallery?: unknown;
  characteristics?: unknown;
  specifications?: unknown;
  variants?: unknown;
  variantAttributes?: unknown;
  dimensions?: unknown;
  photosUrls?: unknown;
  previewImage?: unknown;
};

export type NormalizedProduct = ProductWithLegacyFields & {
  media: string[];
  images: ProductImage[];
  gallery: string[];
  imageUrls: string[];
  characteristics: ProductSpecLike[];
  specifications: ProductSpecLike[];
  specs: ProductSpecLike[];
  variants: Product['variants'];
  dimensions: { dxCm: number; dyCm: number; dzCm: number } | null;
  derivedCharacteristics: Array<{ name: string; value: string }>;
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const toFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const toObjectRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const toStringList = (value: unknown): string[] =>
  toArray<unknown>(value)
    .map((item) => {
      if (typeof item === 'string') return item;
      const objectItem = toObjectRecord(item);
      return objectItem ? toText(objectItem.url) : '';
    })
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeSpecsArray = (value: unknown): ProductSpecLike[] => {
  const list = toArray<unknown>(value);
  const normalized: ProductSpecLike[] = [];

  list.forEach((item, index) => {
    const record = toObjectRecord(item);
    if (!record) return;

    const key =
      toText(record.key) ||
      toText(record.name) ||
      toText(record.title) ||
      toText(record.label);
    const val = toText(record.value);
    if (!key || !val) return;

    normalized.push({
      ...record,
      id: toText(record.id) || `spec-${index}`,
      key,
      value: val,
      sortOrder:
        toFiniteNumber(record.sortOrder) ??
        toFiniteNumber(record.sort_order) ??
        index,
      name: toText(record.name) || undefined,
      title: toText(record.title) || undefined,
      label: toText(record.label) || undefined
    });
  });

  return normalized;
};

const normalizeVariantOptions = (value: unknown): Record<string, string[]> => {
  const record = toObjectRecord(value);
  if (!record) return {};

  const normalized = Object.entries(record).reduce<Record<string, string[]>>((acc, [key, optionValue]) => {
    const values = toArray<unknown>(optionValue)
      .map((item) => toText(item))
      .filter(Boolean);
    if (values.length > 0) {
      acc[key] = values;
    }
    return acc;
  }, {});

  return normalized;
};

const normalizeVariants = (value: unknown): Product['variants'] => {
  const list = toArray<unknown>(value);
  const normalized: ProductVariant[] = [];

  list.forEach((entry, index) => {
    const record = toObjectRecord(entry);
    if (!record) return;

    const id = toText(record.id);
    const name = toText(record.name) || `Вариант ${index + 1}`;
    if (!id) return;

    const optionsFromRecord = normalizeVariantOptions(record.options);
    const optionsFromVariantAttributes = normalizeVariantOptions(record.variantAttributes);
    const options =
      Object.keys(optionsFromRecord).length > 0
        ? optionsFromRecord
        : optionsFromVariantAttributes;

    normalized.push({
      id,
      productId: toText(record.productId) || undefined,
      name,
      options,
      priceDelta: toFiniteNumber(record.priceDelta) ?? undefined,
      sku: toText(record.sku) || undefined,
      stock: toFiniteNumber(record.stock) ?? undefined
    });
  });

  return normalized;
};

const buildSizeValue = (product: ProductWithLegacyFields): string => {
  const dx = toFiniteNumber(product.dxCm);
  const dy = toFiniteNumber(product.dyCm);
  const dz = toFiniteNumber(product.dzCm);
  if (dx === null || dy === null || dz === null) return '';
  return `${dx} × ${dy} × ${dz} см`;
};

export const buildFallbackProductSpecs = (
  product: ProductWithLegacyFields
): Array<{ name: string; value: string }> => {
  const pairs: Array<{ name: string; value: string }> = [
    { name: 'Материал', value: toText(product.material) },
    { name: 'Технология', value: toText(product.technology) },
    { name: 'Цвет', value: toText(product.color) },
    {
      name: 'Срок изготовления',
      value:
        toFiniteNumber(product.productionTimeHours) !== null
          ? `${Number(product.productionTimeHours)} ч`
          : ''
    },
    {
      name: 'Вес',
      value:
        toFiniteNumber(product.weightGrossG) !== null
          ? `${Number(product.weightGrossG)} г`
          : ''
    },
    { name: 'Размер', value: buildSizeValue(product) }
  ];

  return pairs.filter((item) => item.value);
};

export const normalizeProductDto = (
  rawProduct: Product | null | undefined
): NormalizedProduct | null => {
  if (!rawProduct || typeof rawProduct !== 'object') return null;

  const product = rawProduct as ProductWithLegacyFields;

  const normalizedImages = toArray<unknown>(product.images)
    .map((entry, index) => {
      if (typeof entry === 'string') {
        return { id: `img-${index}`, url: entry, sortOrder: index };
      }

      const objectEntry = toObjectRecord(entry);
      if (!objectEntry) return null;

      const url = toText(objectEntry.url);
      if (!url) return null;

      return {
        id: toText(objectEntry.id) || `img-${index}`,
        url,
        sortOrder:
          toFiniteNumber(objectEntry.sortOrder) ??
          toFiniteNumber(objectEntry.sort_order) ??
          index
      };
    })
    .filter((item): item is ProductImage => Boolean(item));

  const media = toStringList(product.media);
  const gallery = toStringList(product.gallery);
  const imageUrls = toStringList(product.imageUrls);
  const imageFallback = toStringList(product.photosUrls);
  const primaryImage = toText(product.image) || toText(product.imageUrl);
  const previewImage = toText(product.previewImage);

  const normalizedCharacteristics = normalizeSpecsArray(product.characteristics);
  const normalizedSpecifications = normalizeSpecsArray(product.specifications);
  const normalizedSpecs = normalizeSpecsArray(product.specs);

  const derivedCharacteristics =
    normalizedSpecs.length || normalizedSpecifications.length || normalizedCharacteristics.length
      ? []
      : buildFallbackProductSpecs(product);

  const dx = toFiniteNumber(product.dxCm);
  const dy = toFiniteNumber(product.dyCm);
  const dz = toFiniteNumber(product.dzCm);

  return {
    ...product,
    media,
    images: normalizedImages,
    gallery,
    imageUrls: [
      ...imageUrls,
      ...normalizedImages.map((item) => item.url),
      ...gallery,
      ...media,
      primaryImage,
      previewImage,
      ...imageFallback
    ].filter(Boolean),
    characteristics: normalizedCharacteristics,
    specifications: normalizedSpecifications,
    specs: normalizedSpecs,
    variants: normalizeVariants(product.variants),
    dimensions: dx !== null && dy !== null && dz !== null ? { dxCm: dx, dyCm: dy, dzCm: dz } : null,
    derivedCharacteristics
  };
};

export const normalizeProductDtoList = (value: unknown): Product[] => {
  const list = toArray<Product>(value);
  const normalized: Product[] = [];
  list.forEach((item) => {
    const next = normalizeProductDto(item);
    if (next) normalized.push(next);
  });
  return normalized;
};
