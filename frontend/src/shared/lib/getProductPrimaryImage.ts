type ProductLike = {
  image?: string | null;
  previewImage?: string | null;
  images?: Array<{ url?: string | null } | string> | null;
};

export const getProductPrimaryImage = (product?: ProductLike | null) => {
  if (!product) return '';

  const firstImage = product.images?.[0];
  if (typeof firstImage === 'string') return firstImage;
  if (firstImage && typeof firstImage === 'object' && firstImage.url) return firstImage.url;

  return product.image ?? product.previewImage ?? '';
};
