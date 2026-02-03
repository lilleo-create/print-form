import { useEffect, useMemo, useState } from 'react';
import type { ProductImage } from '../../shared/types';
import styles from '../../pages/ProductPage.module.css';
import { resolveImageUrl } from './utils';

type ProductGalleryProps = {
  images: ProductImage[];
  title: string;
};

export const ProductGallery = ({ images, title }: ProductGalleryProps) => {
  const resolvedImages = useMemo(
    () => images.map((image) => ({ ...image, resolvedUrl: resolveImageUrl(image.url) })),
    [images]
  );

  const [activeImage, setActiveImage] = useState<string>(resolvedImages[0]?.resolvedUrl ?? '');

  useEffect(() => {
    if (!resolvedImages.length) {
      setActiveImage('');
      return;
    }
    const currentExists = resolvedImages.some((image) => image.resolvedUrl === activeImage);
    if (!currentExists) {
      setActiveImage(resolvedImages[0].resolvedUrl);
    }
  }, [resolvedImages, activeImage]);

  return (
    <div className={styles.gallery}>
      <img src={activeImage} alt={title} className={styles.mainImage} />
      <div className={styles.thumbs}>
        {resolvedImages.map((image) => (
          <button
            key={image.id}
            className={activeImage === image.resolvedUrl ? `${styles.thumb} ${styles.thumbActive}` : styles.thumb}
            onClick={() => setActiveImage(image.resolvedUrl)}
            aria-label={`Показать изображение ${title}`}
            type="button"
          >
            <img src={image.resolvedUrl} alt={title} />
          </button>
        ))}
      </div>
    </div>
  );
};
