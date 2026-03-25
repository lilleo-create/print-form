import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import { useOverlayClose } from '../lib/useOverlayClose';
import styles from './ImageLightbox.module.css';

export type LightboxImage = {
  id?: string;
  src: string;
  alt?: string;
};

type ImageLightboxProps = {
  isOpen: boolean;
  images: LightboxImage[];
  initialIndex?: number;
  onClose: () => void;
  title?: string;
};

export const ImageLightbox = ({ isOpen, images, initialIndex = 0, onClose, title }: ImageLightboxProps) => {
  const normalizedImages = useMemo(() => images.filter((image) => Boolean(image.src)), [images]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    if (!isOpen) return;
    if (!normalizedImages.length) {
      setActiveIndex(0);
      return;
    }

    const safeIndex = Math.min(Math.max(initialIndex, 0), normalizedImages.length - 1);
    setActiveIndex(safeIndex);
  }, [isOpen, initialIndex, normalizedImages]);

  useBodyScrollLock(isOpen);
  const { handlePointerDown, handleClick } = useOverlayClose(onClose);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (normalizedImages.length <= 1) return;

      if (event.key === 'ArrowRight') {
        setActiveIndex((prev) => (prev + 1) % normalizedImages.length);
      }

      if (event.key === 'ArrowLeft') {
        setActiveIndex((prev) => (prev - 1 + normalizedImages.length) % normalizedImages.length);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, normalizedImages.length, onClose]);

  if (!isOpen || !normalizedImages.length) return null;

  const activeImage = normalizedImages[activeIndex];

  const selectPrevious = () => {
    setActiveIndex((prev) => (prev - 1 + normalizedImages.length) % normalizedImages.length);
  };

  const selectNext = () => {
    setActiveIndex((prev) => (prev + 1) % normalizedImages.length);
  };

  return createPortal(
    <div className={styles.overlay} onPointerDown={handlePointerDown} onClick={handleClick} role="presentation">
      <div className={styles.container} onClick={(event) => event.stopPropagation()}>
        <button className={styles.closeButton} type="button" aria-label="Закрыть просмотр" onClick={onClose}>
          ✕
        </button>

        <div className={styles.viewer}>
          {normalizedImages.length > 1 && (
            <button type="button" className={clsx(styles.arrow, styles.arrowLeft)} onClick={selectPrevious} aria-label="Предыдущее изображение">
              ‹
            </button>
          )}

          <img
            src={activeImage.src}
            alt={activeImage.alt ?? title ?? 'Увеличенное изображение товара'}
            className={styles.image}
          />

          {normalizedImages.length > 1 && (
            <button type="button" className={clsx(styles.arrow, styles.arrowRight)} onClick={selectNext} aria-label="Следующее изображение">
              ›
            </button>
          )}
        </div>

        {normalizedImages.length > 1 && (
          <div className={styles.thumbs}>
            {normalizedImages.map((image, index) => (
              <button
                key={image.id ?? image.src}
                type="button"
                className={clsx(styles.thumb, index === activeIndex && styles.thumbActive)}
                onClick={() => setActiveIndex(index)}
                aria-label={`Открыть изображение ${index + 1}`}
              >
                <img src={image.src} alt={image.alt ?? title ?? `Изображение ${index + 1}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
