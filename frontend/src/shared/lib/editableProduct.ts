import type { Product, ProductSpec, ProductVariant } from '../types';
import { getProductImages, getProductVideos } from './productMedia';

type ProductLike = Partial<Product> & {
  imageUrl?: string | null;
  imageUrls?: Array<string | null | undefined>;
  images?: Array<{ url?: string | null } | string | null> | null;
  specs?: ProductSpec[] | null;
  characteristics?: ProductSpec[] | null;
  variants?: ProductVariant[] | null;
};

export interface EditableProduct {
  id: string;
  title: string;
  descriptionShort: string;
  description: string;
  descriptionFull: string;
  category: string;
  material: string;
  technology: string;
  color: string;
  price: number;
  sku: string;
  productionTimeHours: number;
  imageUrls: string[];
  videoUrls: string[];
  characteristics: ProductSpec[];
  variants: ProductVariant[];
  weightGrossG?: number;
  dxCm?: number;
  dyCm?: number;
  dzCm?: number;
}

const toText = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const toNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const toEditableProduct = (
  product: ProductLike | null | undefined
): EditableProduct | null => {
  if (!product?.id) return null;

  const description = toText(product.description);
  const descriptionShort = toText(product.descriptionShort) || description;
  const descriptionFull = toText(product.descriptionFull) || description;

  return {
    id: product.id,
    title: toText(product.title),
    descriptionShort,
    description,
    descriptionFull,
    category: toText(product.category),
    material: toText(product.material),
    technology: toText(product.technology),
    color: toText(product.color),
    price: toNumber(product.price, 0),
    sku: toText(product.sku),
    productionTimeHours: toNumber(product.productionTimeHours, 24),
    imageUrls: getProductImages(product),
    videoUrls: getProductVideos(product),
    characteristics: product.specs ?? product.characteristics ?? [],
    variants: product.variants ?? [],
    weightGrossG:
      typeof product.weightGrossG === 'number' ? product.weightGrossG : undefined,
    dxCm: typeof product.dxCm === 'number' ? product.dxCm : undefined,
    dyCm: typeof product.dyCm === 'number' ? product.dyCm : undefined,
    dzCm: typeof product.dzCm === 'number' ? product.dzCm : undefined
  };
};