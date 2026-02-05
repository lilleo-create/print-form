import { useState } from 'react';
import { api } from '../../shared/api';
import { ReturnReason } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { ReturnReasonRadioGroup } from './ReturnReasonRadioGroup';
import { ReturnPhotoUploader } from './ReturnPhotoUploader';
import styles from './ReturnCreateFlow.module.css';

export interface ReturnCandidate {
  orderItemId: string;
  productId: string;
  title: string;
  price: number;
  image?: string;
  orderDate: string;
  orderId: string;
}

interface ReturnCreateFlowProps {
  item: ReturnCandidate;
  onCreated?: () => void;
  onAlreadyExists?: () => void;
}

const getErrorCode = (error: unknown) => {
  if (!error || typeof error !== 'object') return null;
  const payload = 'payload' in error ? (error as { payload?: unknown }).payload : null;
  if (!payload || typeof payload !== 'object') return null;
  const errorPayload = 'error' in payload ? (payload as { error?: unknown }).error : null;
  if (errorPayload && typeof errorPayload === 'object' && 'code' in errorPayload) {
    return String((errorPayload as { code?: unknown }).code ?? '');
  }
  return null;
};

export const ReturnCreateFlow = ({ item, onCreated, onAlreadyExists }: ReturnCreateFlowProps) => {
  const [reason, setReason] = useState<ReturnReason>('NOT_FIT');
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let photosUrls: string[] = [];
      if (files.length > 0) {
        const uploadResponse = await api.returns.uploadPhotos(files);
        photosUrls = uploadResponse.data.urls ?? [];
      }
      await api.returns.create({
        orderItemId: item.orderItemId,
        reason,
        comment: comment.trim() || undefined,
        photosUrls
      });
      onCreated?.();
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'RETURN_ALREADY_EXISTS') {
        onAlreadyExists?.();
        return;
      }
      setError('Не удалось создать заявку на возврат.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.flow}>
      <h3>Оформление возврата</h3>
      <div className={styles.summary}>
        {item.image && <img src={item.image} alt={item.title} />}
        <div>
          <p className={styles.caption}>
            Заказ от{' '}
            {new Date(item.orderDate).toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })}
          </p>
          <strong>{item.title}</strong>
          <p>{item.price.toLocaleString('ru-RU')} ₽</p>
        </div>
      </div>
      <div className={styles.section}>
        <p className={styles.label}>Причина возврата</p>
        <ReturnReasonRadioGroup value={reason} onChange={setReason} />
      </div>
      <div className={styles.section}>
        <label className={styles.field}>
          <span>Комментарий</span>
          <textarea
            value={comment}
            placeholder="Расскажите в деталях, что не так"
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.section}>
        <p className={styles.label}>
          Сделайте фото в хорошем качестве, по которым можно оценить состояние товара
        </p>
        <ReturnPhotoUploader files={files} onChange={setFiles} />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <Button type="button" onClick={handleSubmit} disabled={submitting}>
          Продолжить
        </Button>
      </div>
    </div>
  );
};
