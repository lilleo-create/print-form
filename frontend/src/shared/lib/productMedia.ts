import type { Product, ProductImage } from '../types';

export const getProductImageCandidates = (product: Partial<Product> | null | undefined): string[] => {
  if (!product) return [];

  const fromImages = (product.images ?? [])
    .map((image) => image?.url)
    .filter((url): url is string => Boolean(url));

  const fromImageUrls = (product.imageUrls ?? []).filter((url): url is string => Boolean(url));

  const fromLegacy = (product as { photosUrls?: string[]; previewImage?: string }).photosUrls ?? [];
  const previewImage = (product as { photosUrls?: string[]; previewImage?: string }).previewImage;

  return [product.image, ...fromImages, ...fromImageUrls, ...fromLegacy, previewImage].filter(
    (url): url is string => Boolean(url)
  );
};

export const getProductMainImage = (product: Partial<Product> | null | undefined): string =>
  getProductImageCandidates(product)[0] ?? '';

export const toProductImageList = (product: Partial<Product>): ProductImage[] => {
  const images = (product.images ?? []).filter((image): image is ProductImage => Boolean(image?.url));
  if (images.length > 0) {
    return images;
  }

  return getProductImageCandidates(product).map((url, index) => ({
    id: `fallback-${index}`,
    url,
    sortOrder: index
  }));
};
