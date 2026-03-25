import { useEffect, useMemo, useState } from 'react';
import type { ProductImage } from '../../shared/types';
import styles from '../../pages/ProductPage.module.css';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import { ImageLightbox } from '../../shared/ui/ImageLightbox';

type ProductGalleryProps = {
  images: ProductImage[];
  title: string;
};

export const ProductGallery = ({ images, title }: ProductGalleryProps) => {
  const resolvedImages = useMemo(
    () => images.map((image) => ({ ...image, resolvedUrl: resolveImageUrl(image.url) })),
    [images]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!resolvedImages.length) {
      setActiveIndex(0);
      return;
    }

    if (activeIndex >= resolvedImages.length) {
      setActiveIndex(0);
    }
  }, [resolvedImages, activeIndex]);

  const activeImage = resolvedImages[activeIndex]?.resolvedUrl ?? '';

  const openLightbox = (index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className={styles.gallery}>
      <button
        type="button"
        className={styles.mainImageButton}
        onClick={() => openLightbox(activeIndex)}
        aria-label={`Открыть увеличенное изображение ${title}`}
      >
        <img src={activeImage} alt={title} className={styles.mainImage} />
      </button>

      <div className={styles.thumbs}>
        {resolvedImages.map((image, index) => (
          <button
            key={image.id}
            className={activeIndex === index ? `${styles.thumb} ${styles.thumbActive}` : styles.thumb}
            onClick={() => openLightbox(index)}
            aria-label={`Показать изображение ${title}`}
            type="button"
          >
            <img src={image.resolvedUrl} alt={title} />
          </button>
        ))}
      </div>

      <ImageLightbox
        isOpen={isLightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={resolvedImages.map((image) => ({ id: image.id, src: image.resolvedUrl, alt: title }))}
        initialIndex={activeIndex}
        title={title}
      />
    </div>
  );
};
