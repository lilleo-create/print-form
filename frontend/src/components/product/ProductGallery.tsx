import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProductImage } from '../../shared/types';
import styles from '../../pages/ProductPage.module.css';
import { ImageLightbox } from '../../shared/ui/ImageLightbox';
import { SmartImage } from '../../shared/ui/SmartImage';

type ProductGalleryProps = {
  images: ProductImage[];
  title: string;
};

export const ProductGallery = ({ images, title }: ProductGalleryProps) => {
  const resolvedImages = useMemo(() => images.map((image) => ({ ...image, resolvedUrl: image.url ?? '' })), [images]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [mobileIdx, setMobileIdx] = useState(0);
  const [isLightboxOpen, setLightboxOpen] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resolvedImages.length) { setActiveIndex(0); return; }
    if (activeIndex >= resolvedImages.length) setActiveIndex(0);
  }, [resolvedImages, activeIndex]);

  const activeImage = resolvedImages[activeIndex]?.resolvedUrl ?? '';

  const openLightbox = (index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  };

  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const slideWidth = el.clientWidth * 0.88 + 10;
    const idx = Math.min(Math.round(el.scrollLeft / slideWidth), resolvedImages.length - 1);
    setMobileIdx(Math.max(0, idx));
  };

  const scrollToSlide = (index: number) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({ left: index * (el.clientWidth * 0.88 + 10), behavior: 'smooth' });
  };

  return (
    <>
      {/* Desktop: thumbs strip + main image */}
      <div className={styles.gallery}>
        <div className={styles.thumbs}>
          {resolvedImages.map((image, index) => (
            <button
              key={image.id}
              className={activeIndex === index ? `${styles.thumb} ${styles.thumbActive}` : styles.thumb}
              onClick={() => setActiveIndex(index)}
              aria-label={`Показать изображение ${title}`}
              type="button"
            >
              <SmartImage src={image.resolvedUrl} alt={title} sizePreset="card" />
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.mainImageButton}
          onClick={() => openLightbox(activeIndex)}
          aria-label={`Открыть увеличенное изображение ${title}`}
        >
          <SmartImage src={activeImage} alt={title} className={styles.mainImage} sizePreset="detail" />
        </button>
      </div>

      {/* Mobile: peek carousel with scroll snap */}
      <div
        ref={carouselRef}
        className={styles.mobileCarousel}
        onScroll={handleCarouselScroll}
      >
        {resolvedImages.map((image, index) => (
          <button
            key={image.id}
            type="button"
            className={styles.mobileCarouselSlide}
            onClick={() => openLightbox(index)}
            aria-label={`Фото ${index + 1} из ${resolvedImages.length}`}
          >
            <img
              src={image.resolvedUrl}
              alt={title}
              loading={index === 0 ? 'eager' : 'lazy'}
            />
          </button>
        ))}
      </div>

      {resolvedImages.length > 1 && (
        <div className={styles.mobileDots}>
          {resolvedImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className={mobileIdx === index ? styles.mobileDotActive : styles.mobileDot}
              onClick={() => scrollToSlide(index)}
              aria-label={`Фото ${index + 1}`}
            />
          ))}
        </div>
      )}

      <ImageLightbox
        isOpen={isLightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={resolvedImages.map((image) => ({
          id: image.id,
          src: image.resolvedUrl,
          thumbSrc: image.resolvedUrl,
          alt: title
        }))}
        initialIndex={activeIndex}
        title={title}
      />
    </>
  );
};
