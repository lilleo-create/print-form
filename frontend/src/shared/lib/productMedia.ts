import type { Product, ProductImage } from '../types';
import {
  dedupeUrls,
  resolveMediaUrl,
  resolveMediaUrls
} from './resolveMediaUrl';

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

  const fromImageObjects = (product.images ?? []).map((image) =>
    typeof image === 'string' ? image : image?.url
  );
  const fromLegacy = product.photosUrls ?? [];

  return getMediaArray(
    fromImageObjects,
    product.imageUrls,
    product.image,
    product.previewImage,
    fromLegacy
  );
};

export const getProductVideos = (
  product: ProductLike | null | undefined
): string[] => {
  if (!product) return [];

  return resolveMediaUrls(product.videoUrls ?? []);
};

export const getProductImageCandidates = (
  product: ProductLike | null | undefined
): string[] => getProductImages(product);

export const getProductMainImage = (
  product: ProductLike | null | undefined
): string => getProductImages(product)[0] ?? '';

export const toProductImageList = (product: ProductLike): ProductImage[] => {
  const normalizedImages = (product.images ?? [])
    .map((image, index) => {
      if (!image) return null;

      if (typeof image === 'string') {
        const resolvedUrl = resolveMediaUrl(image);
        if (!resolvedUrl) return null;
        return {
          id: `fallback-${index}`,
          sortOrder: index,
          url: resolvedUrl
        } satisfies ProductImage;
      }

      const resolvedUrl = resolveMediaUrl(image.url);
      if (!resolvedUrl) return null;

      return {
        ...image,
        url: resolvedUrl
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
