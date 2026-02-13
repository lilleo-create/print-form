import { useMemo, useState } from 'react';
import { resolveReturnPhotoUrl } from '../../shared/lib/resolveReturnPhotoUrl';
import { ReturnPhoto } from '../../shared/types';
import { Modal } from '../../shared/ui/Modal';
import styles from './ReturnPhotos.module.css';

interface ReturnPhotosProps {
  photos: ReturnPhoto[];
}

export const ReturnPhotos = ({ photos }: ReturnPhotosProps) => {
  const resolvedPhotos = useMemo(() => {
    const urls = photos
      .map((photo) => resolveReturnPhotoUrl(photo.url))
      .filter((url) => Boolean(url));
    return Array.from(new Set(urls));
  }, [photos]);

  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  if (resolvedPhotos.length === 0) {
    return null;
  }

  const handleError = (url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url));
  };

  const isFailed = (url: string) => failedUrls.has(url);

  return (
    <div className={styles.section}>
      <p className={styles.title}>Фото</p>
      <div className={styles.grid}>
        {resolvedPhotos.map((url) => (
          <button
            key={url}
            type="button"
            className={styles.thumbButton}
            onClick={() => setActiveUrl(url)}
            aria-label="Открыть фото"
          >
            {isFailed(url) ? (
              <span className={styles.thumbFallback}>Фото недоступно</span>
            ) : (
              <img src={url} alt="Фото возврата" onError={() => handleError(url)} />
            )}
          </button>
        ))}
      </div>

      <Modal isOpen={Boolean(activeUrl)} onClose={() => setActiveUrl(null)} className={styles.modal}>
        <div className={styles.modalContent} onClick={() => setActiveUrl(null)}>
          {activeUrl && isFailed(activeUrl) ? (
            <div className={styles.modalFallback}>Фото недоступно</div>
          ) : (
            activeUrl && <img src={activeUrl ?? ''} alt="Фото возврата" />
          )}
        </div>
      </Modal>
    </div>
  );
};
