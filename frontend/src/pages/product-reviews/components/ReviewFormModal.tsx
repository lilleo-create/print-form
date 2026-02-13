import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Product, Review } from '../../../shared/types';
import { Button } from '../../../shared/ui/Button';
import { ReturnPhotoUploader } from '../../../components/returns/ReturnPhotoUploader';
import { resolveImageUrl } from '../../../shared/lib/resolveImageUrl';
import { getProductPrimaryImage } from '../../../shared/lib/getProductPrimaryImage';
import styles from './ReviewFormModal.module.css';

export type ReviewFormValues = {
  rating: number;
  pros: string;
  cons: string;
  comment: string;
  files: File[];
  existingPhotos: string[];
};

type ReviewFieldKey = 'pros' | 'cons' | 'comment' | 'photos';

type ReviewFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  initialReview: Review | null;
  onSubmit: (values: ReviewFormValues) => Promise<void>;
  submitting: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<ReviewFieldKey, string>>;
};

const ratingLabels = [
  'Ужасный товар',
  'Плохой товар',
  'Нормальный товар',
  'Хороший товар',
  'Отличный товар'
];

export const ReviewFormModal = ({
  isOpen,
  onClose,
  product,
  initialReview,
  onSubmit,
  submitting,
  error,
  fieldErrors
}: ReviewFormModalProps) => {
  const [rating, setRating] = useState(5);
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setRating(initialReview?.rating ?? 5);
    setPros(initialReview?.pros ?? '');
    setCons(initialReview?.cons ?? '');
    setComment(initialReview?.comment ?? '');
    setFiles([]);
    setExistingPhotos(initialReview?.photos ?? []);
    setProductImageError(false);
  }, [initialReview, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const ratingLabel = useMemo(() => ratingLabels[rating - 1] ?? '', [rating]);
  const [productImageError, setProductImageError] = useState(false);

  const productImageSrc = resolveImageUrl(getProductPrimaryImage(product));
  const showProductImage = Boolean(productImageSrc) && !productImageError;

  if (!isOpen) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ rating, pros, cons, comment, files, existingPhotos });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <h2>Как вам товар?</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </header>

        <div className={styles.product}>
          {showProductImage ? (
            <img src={productImageSrc} alt={product.title} onError={() => setProductImageError(true)} />
          ) : (
            <div className={styles.productImagePlaceholder}>Нет изображения</div>
          )}
          <div>
            <span>{product.title}</span>
            {typeof product.price === 'number' ? (
              <p className={styles.productPrice}>{product.price.toLocaleString('ru-RU')} ₽</p>
            ) : null}
          </div>
        </div>

        <div className={styles.ratingBlock}>
          <div className={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={value <= rating ? styles.starActive : styles.star}
                onClick={() => setRating(value)}
                aria-label={`Оценка ${value}`}
              >
                ★
              </button>
            ))}
          </div>
          <p className={styles.ratingLabel}>{ratingLabel}</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Достоинства
            <input
              value={pros}
              onChange={(event) => setPros(event.target.value)}
              required
              aria-invalid={Boolean(fieldErrors?.pros)}
            />
            {fieldErrors?.pros && <p className={styles.fieldError}>{fieldErrors.pros}</p>}
          </label>

          <label>
            Недостатки
            <input
              value={cons}
              onChange={(event) => setCons(event.target.value)}
              required
              aria-invalid={Boolean(fieldErrors?.cons)}
            />
            {fieldErrors?.cons && <p className={styles.fieldError}>{fieldErrors.cons}</p>}
          </label>

          <label>
            Комментарий
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              required
              minLength={10}
              aria-invalid={Boolean(fieldErrors?.comment)}
              placeholder="Например, ваши ожидания, впечатления и советы другим покупателям"
            />
            {fieldErrors?.comment && <p className={styles.fieldError}>{fieldErrors.comment}</p>}
          </label>

          {existingPhotos.length > 0 && (
            <div className={styles.existingPhotos}>
              {existingPhotos.map((photo) => (
                <div key={photo} className={styles.existingPhoto}>
                  <img src={resolveImageUrl(photo)} alt="Фото отзыва" />
                  <button
                    type="button"
                    onClick={() => setExistingPhotos((prev) => prev.filter((item) => item !== photo))}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.uploader}>
            <ReturnPhotoUploader files={files} onChange={setFiles} />
            {fieldErrors?.photos && <p className={styles.fieldError}>{fieldErrors.photos}</p>}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <Button type="submit" disabled={submitting || comment.trim().length < 10}>
            {submitting ? 'Отправляем...' : 'Отправить'}
          </Button>
        </form>
      </div>
    </div>
  );
};
