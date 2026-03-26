import type { Product, ProductImage } from '../types';
import {
  dedupeUrls,
  resolveMediaUrl,
  resolveMediaUrls
} from './resolveMediaUrl';
import { normalizeProductDto } from './normalizeProductDto';

type ProductLike = Partial<Product> & {
  photosUrls?: string[];
  previewImage?: string;
};

export const getMediaArray = (
  ...sources: Array<
    Array<string | null | undefined> | string | null | undefined
  >
): string[] => {
  const flat: Array<string | null | undefined> = [];

  for (const source of sources) {
    if (Array.isArray(source)) {
      flat.push(...source);
      continue;
    }

    flat.push(source);
  }

  return resolveMediaUrls(flat);
};

export const getProductImages = (
  product: ProductLike | null | undefined
): string[] => {
  if (!product) return [];

  const normalized = normalizeProductDto(product as Product);
  if (!normalized) return [];

  const fromImageObjects = normalized.images.map((image) => image.url);
  const fromLegacy = Array.isArray(product.photosUrls) ? product.photosUrls : [];

  return getMediaArray(
    fromImageObjects,
    normalized.imageUrls,
    normalized.gallery,
    normalized.media,
    product.image,
    product.previewImage,
    fromLegacy
  );
};

export const getProductVideos = (
  product: ProductLike | null | undefined
): string[] => {
  if (!product) return [];

  const list = Array.isArray(product.videoUrls) ? product.videoUrls : [];
  return resolveMediaUrls(list);
};

export const getProductImageCandidates = (
  product: ProductLike | null | undefined
): string[] => getProductImages(product);

export const getProductMainImage = (
  product: ProductLike | null | undefined
): string => getProductImages(product)[0] ?? '';

export const toProductImageList = (product: ProductLike): ProductImage[] => {
  const normalized = normalizeProductDto(product as Product);
  const normalizedImages = (normalized?.images ?? [])
    .map((image, index) => {
      const resolvedUrl = resolveMediaUrl(image.url);
      if (!resolvedUrl) return null;

      return {
        ...image,
        id: image.id || `fallback-${index}`,
        url: resolvedUrl,
        sortOrder: typeof image.sortOrder === 'number' ? image.sortOrder : index
      } satisfies ProductImage;
    })
    .filter((image): image is ProductImage => Boolean(image));

  if (normalizedImages.length > 0) {
    return normalizedImages;
  }

  return dedupeUrls(getProductImages(product)).map((url, index) => ({
    id: `fallback-${index}`,
    url,
    sortOrder: index
  }));
};
