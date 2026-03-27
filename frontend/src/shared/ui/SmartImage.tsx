import { ImgHTMLAttributes, useEffect, useMemo, useState } from 'react';
import { buildImageVariants, ImageSizePreset } from '../lib/imageUrlBuilder';
import styles from './SmartImage.module.css';

type SmartImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  sizePreset?: ImageSizePreset;
  skeletonClassName?: string;
};

const preloadImage = (url: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('Empty url'));
      return;
    }

    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Image load failed'));
    image.src = url;
  });

export const SmartImage = ({
  src,
  alt,
  className,
  sizePreset = 'card',
  skeletonClassName,
  loading = 'lazy',
  decoding = 'async',
  ...imgProps
}: SmartImageProps) => {
  const variants = useMemo(() => buildImageVariants(src, sizePreset), [src, sizePreset]);
  const [activeSrc, setActiveSrc] = useState(variants.previewFallback || variants.fallback);
  const [isHighLoaded, setHighLoaded] = useState(false);
  const [isPreviewLoaded, setPreviewLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setActiveSrc(variants.previewFallback || variants.fallback);
    setHighLoaded(false);
    setPreviewLoaded(false);

    const loadPreview = async () => {
      const previewCandidate = variants.previewWebp || variants.previewFallback;
      const previewFallback = variants.previewFallback;
      if (!previewCandidate && !previewFallback) {
        setPreviewLoaded(true);
        return;
      }

      try {
        await preloadImage(previewCandidate);
        if (isMounted) {
          setActiveSrc(previewCandidate);
          setPreviewLoaded(true);
        }
      } catch {
        if (!previewFallback) {
          if (isMounted) {
            setPreviewLoaded(true);
          }
          return;
        }
        try {
          await preloadImage(previewFallback);
          if (isMounted) {
            setActiveSrc(previewFallback);
            setPreviewLoaded(true);
          }
        } catch {
          if (isMounted) {
            setPreviewLoaded(true);
          }
        }
      }
    };

    const loadHigh = async () => {
      const highCandidate = variants.webp || variants.fallback;
      const highFallback = variants.fallback;
      if (!highCandidate && !highFallback) {
        return;
      }

      try {
        await preloadImage(highCandidate);
        if (isMounted) {
          setActiveSrc(highCandidate);
          setHighLoaded(true);
        }
      } catch {
        if (!highFallback) {
          return;
        }
        try {
          await preloadImage(highFallback);
          if (isMounted) {
            setActiveSrc(highFallback);
            setHighLoaded(true);
          }
        } catch {
          // noop
        }
      }
    };

    void loadPreview();
    void loadHigh();

    return () => {
      isMounted = false;
    };
  }, [variants]);

  if (!variants.fallback && !variants.webp) {
    return null;
  }

  const imageClassName = [styles.image, className, !isHighLoaded ? styles.blurred : ''].filter(Boolean).join(' ');
  const skeletonVisible = !isPreviewLoaded;

  return (
    <div className={styles.wrapper}>
      {skeletonVisible ? <span className={[styles.skeleton, skeletonClassName].filter(Boolean).join(' ')} aria-hidden="true" /> : null}
      <picture>
        {variants.webp ? <source srcSet={variants.webp} type="image/webp" /> : null}
        <img {...imgProps} src={activeSrc || variants.fallback} alt={alt} className={imageClassName} loading={loading} decoding={decoding} />
      </picture>
    </div>
  );
};
