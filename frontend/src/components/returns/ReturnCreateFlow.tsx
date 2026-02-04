import { useMemo, useState } from 'react';
import { api } from '../../shared/api';
import { ReturnReason } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { ReturnReasonRadioGroup } from './ReturnReasonRadioGroup';
import { ReturnPhotoUploader } from './ReturnPhotoUploader';
import styles from './ReturnCreateFlow.module.css';

interface ReturnCandidate {
  orderItemId: string;
  productId: string;
  title: string;
  price: number;
  image?: string;
  orderDate: string;
  orderId: string;
}

interface ReturnCreateFlowProps {
  items: ReturnCandidate[];
  onCreated?: () => void;
  onReturnToList?: () => void;
}

type Step = 'select' | 'form' | 'success';

export const ReturnCreateFlow = ({ items, onCreated, onReturnToList }: ReturnCreateFlowProps) => {
  const [step, setStep] = useState<Step>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState<ReturnReason>('NOT_FIT');
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.orderItemId === selectedId) ?? null,
    [items, selectedId]
  );

  const handleContinue = () => {
    if (!selectedId) return;
    setStep('form');
  };

  const handleSubmit = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    setError(null);
    try {
      let photosUrls: string[] = [];
      if (files.length > 0) {
        const uploadResponse = await api.returns.uploadPhotos(files);
        photosUrls = uploadResponse.data.urls ?? [];
      }
      await api.returns.create({
        orderItemId: selectedItem.orderItemId,
        reason,
        comment: comment.trim() || undefined,
        photosUrls
      });
      setStep('success');
      onCreated?.();
    } catch {
      setError('Не удалось создать заявку на возврат.');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return <p className={styles.empty}>Пока нет товаров для возврата.</p>;
  }

  if (step === 'success') {
    return (
      <div className={styles.success}>
        <h3>Заявка создана</h3>
        <Button type="button" onClick={onReturnToList}>
          Перейти на страницу возвратов
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.flow}>
      {step === 'select' && (
        <>
          <h3>Выберите товар для возврата</h3>
          <div className={styles.list}>
            {items.map((item) => (
              <label key={item.orderItemId} className={styles.card}>
                <input
                  type="radio"
                  name="return-item"
                  value={item.orderItemId}
                  checked={selectedId === item.orderItemId}
                  onChange={() => setSelectedId(item.orderItemId)}
                />
                <div className={styles.cardBody}>
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
              </label>
            ))}
          </div>
          <Button type="button" onClick={handleContinue} disabled={!selectedId}>
            Продолжить
          </Button>
        </>
      )}

      {step === 'form' && selectedItem && (
        <>
          <h3>Оформление возврата</h3>
          <div className={styles.summary}>
            {selectedItem.image && <img src={selectedItem.image} alt={selectedItem.title} />}
            <div>
              <strong>{selectedItem.title}</strong>
              <p>{selectedItem.price.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>
          <div className={styles.section}>
            <p className={styles.label}>Причина возврата</p>
            <ReturnReasonRadioGroup value={reason} onChange={setReason} />
          </div>
          <div className={styles.section}>
            <p className={styles.label}>Комментарий</p>
            <textarea
              value={comment}
              placeholder="Расскажите в деталях, что не так"
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
          <div className={styles.section}>
            <p className={styles.label}>
              Сделайте фото в хорошем качестве, по которым можно оценить состояние товара
            </p>
            <ReturnPhotoUploader files={files} onChange={setFiles} />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            Продолжить
          </Button>
        </>
      )}
    </div>
  );
};
