import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api';
import { normalizeApiError } from '../../shared/api/client';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import { ReturnReason } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { ReturnCandidate } from './ReturnCandidatesList';
import { ReturnReasonRadioGroup } from './ReturnReasonRadioGroup';
import { ReturnPhotoUploader } from './ReturnPhotoUploader';
import { StickyActionBar } from './StickyActionBar';
import styles from './ReturnCreateFlow.module.css';

export type ReturnCreateStep = 'select' | 'form' | 'success' | 'exists';

interface ReturnCreateFlowProps {
  items: ReturnCandidate[];
  initialSelectedId?: string | null;
  step?: ReturnCreateStep;
  onStepChange?: (step: ReturnCreateStep) => void;
  onCreated?: () => void;
  onReturnToList?: () => void;
}

type FieldErrors = {
  comment?: string;
  reason?: string;
  photos?: string;
};

const MAX_FILES = 10;
const MAX_SIZE = 10 * 1024 * 1024;
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

export const ReturnCreateFlow = ({
  items,
  initialSelectedId,
  step: stepProp,
  onStepChange,
  onCreated,
  onReturnToList
}: ReturnCreateFlowProps) => {
  const navigate = useNavigate();
  const [internalStep, setInternalStep] = useState<ReturnCreateStep>(initialSelectedId ? 'form' : 'select');
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [reason, setReason] = useState<ReturnReason>('NOT_FIT');
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showErrors, setShowErrors] = useState(false);
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.orderItemId === selectedId) ?? null,
    [items, selectedId]
  );
  const summaryImage = selectedItem ? resolveImageUrl(selectedItem.image) : '';

  const step = stepProp ?? internalStep;
  const isStepControlled = stepProp !== undefined;
  const setStepState = (nextStep: ReturnCreateStep) => {
    if (isStepControlled) {
      onStepChange?.(nextStep);
    } else {
      setInternalStep(nextStep);
    }
  };

  useEffect(() => {
    if (!initialSelectedId) return;
    setSelectedId(initialSelectedId);
    if (isStepControlled) {
      onStepChange?.('form');
    } else {
      setInternalStep('form');
    }
  }, [initialSelectedId, isStepControlled, onStepChange]);

  useEffect(() => {
    setShowErrors(false);
    setFieldErrors({});
    setFormError(null);
    setCreatedThreadId(null);
    setComment('');
    setFiles([]);
    setReason('NOT_FIT');
  }, [selectedId]);

  const validateForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!reason) {
      errors.reason = 'Выберите причину возврата';
    }
    const trimmed = comment.trim();
    if (trimmed.length < 5) {
      errors.comment = 'Опишите проблему, минимум 5 символов';
    } else if (trimmed.length > 2000) {
      errors.comment = 'Комментарий не должен превышать 2000 символов';
    }
    if (files.length > MAX_FILES) {
      errors.photos = 'Можно добавить не больше 10 фото';
    } else {
      const invalidType = files.find((file) => !allowedTypes.includes(file.type));
      if (invalidType) {
        errors.photos = 'Неподдерживаемый формат. Только JPG/PNG/WebP';
      }
      const invalidSize = files.find((file) => file.size > MAX_SIZE);
      if (invalidSize) {
        errors.photos = 'Файл слишком большой. Максимум 10 МБ';
      }
    }
    return errors;
  };

  const currentErrors = useMemo(validateForm, [comment, files, reason]);
  const isFormValid = Object.keys(currentErrors).length === 0;

  useEffect(() => {
    if (!showErrors) return;
    setFieldErrors(currentErrors);
  }, [currentErrors, showErrors]);

  const handleContinue = () => {
    if (!selectedId) return;
    setStepState('form');
  };

  const handleSubmit = async () => {
    if (!selectedItem) return;
    setShowErrors(true);
    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      let photosUrls: string[] = [];
      if (files.length > 0) {
        try {
          const uploadResponse = await api.returns.uploadPhotos(files);
          photosUrls = uploadResponse.data.urls ?? [];
        } catch (uploadError) {
          const normalizedUpload = normalizeApiError(uploadError);
          if (normalizedUpload.code === 'RETURN_UPLOAD_FILE_TYPE_INVALID') {
            setShowErrors(true);
            setFieldErrors((prev) => ({ ...prev, photos: 'Неподдерживаемый формат. Только JPG/PNG/WebP' }));
            return;
          }
          if (normalizedUpload.code === 'RETURN_UPLOAD_FILE_TOO_LARGE') {
            setShowErrors(true);
            setFieldErrors((prev) => ({ ...prev, photos: 'Файл слишком большой. Максимум 10 МБ' }));
            return;
          }
          if (normalizedUpload.code === 'RETURN_UPLOAD_TOO_MANY_FILES') {
            setShowErrors(true);
            setFieldErrors((prev) => ({ ...prev, photos: 'Можно добавить не больше 10 фото' }));
            return;
          }
          setShowErrors(true);
          setFieldErrors((prev) => ({
            ...prev,
            photos: 'Не удалось загрузить фото. Проверьте интернет и попробуйте ещё раз'
          }));
          return;
        }
      }
      const response = await api.returns.create({
        orderItemId: selectedItem.orderItemId,
        reason,
        comment: comment.trim(),
        photosUrls
      });
      setCreatedThreadId(response.data?.chatThread?.id ?? null);
      setStepState('success');
      onCreated?.();
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.code === 'RETURN_ALREADY_EXISTS') {
        setStepState('exists');
        return;
      }
      if (normalized.code === 'ORDER_ITEM_NOT_FOUND') {
        setFormError('Товар не найден или не доступен для возврата');
        return;
      }
      if (normalized.status === 401) {
        setFormError('Сессия истекла, войдите снова');
        return;
      }
      if (normalized.code === 'VALIDATION_ERROR' && normalized.issues?.length) {
        const next: FieldErrors = {};
        normalized.issues.forEach((issue) => {
          if (issue.path.includes('comment')) {
            next.comment = issue.message;
          } else if (issue.path.includes('reason')) {
            next.reason = issue.message;
          } else if (issue.path.includes('photosUrls')) {
            next.photos = issue.message;
          }
        });
        setShowErrors(true);
        setFieldErrors(next);
        setFormError('Проверьте поля формы');
        return;
      }
      setFormError('Не удалось отправить заявку. Попробуйте ещё раз');
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
        <div className={styles.successActions}>
          <Button
            type="button"
            onClick={() =>
              navigate(`/account?tab=chats${createdThreadId ? `&threadId=${createdThreadId}` : ''}`)
            }
          >
            Перейти в чат
          </Button>
          <Button type="button" variant="secondary" onClick={onReturnToList}>
            Перейти на страницу возвратов
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'exists') {
    return (
      <div className={styles.success}>
        <h3>Заявка уже создана</h3>
        <p className={styles.helper}>Откройте чат, чтобы узнать статус возврата.</p>
        <div className={styles.successActions}>
          <Button type="button" onClick={() => navigate('/account?tab=chats')}>
            Перейти в чат
          </Button>
          <Button type="button" variant="secondary" onClick={onReturnToList}>
            Перейти на страницу возвратов
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.flow}>
      {step === 'select' && (
        <>
          <h3>Что хотите вернуть?</h3>
          <div className={styles.list}>
            {items.map((item) => {
              const imageSrc = resolveImageUrl(item.image);
              return (
                <label
                  key={item.orderItemId}
                  className={`${styles.card} ${selectedId === item.orderItemId ? styles.cardSelected : ''}`}
                >
                  <span className={styles.cardBody}>
                    {imageSrc ? (
                      <img className={styles.cardImage} src={imageSrc} alt={item.title} />
                    ) : (
                      <span className={styles.imagePlaceholder} aria-hidden="true" />
                    )}
                    <span className={styles.cardText}>
                      <span className={styles.caption}>
                        Заказ от{' '}
                        {new Date(item.orderDate).toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                      <strong className={styles.cardTitle}>{item.title}</strong>
                      <span className={styles.cardPrice}>{item.price.toLocaleString('ru-RU')} ₽</span>
                    </span>
                  </span>
                  <input
                    className={styles.cardRadio}
                    type="radio"
                    name="return-item"
                    value={item.orderItemId}
                    checked={selectedId === item.orderItemId}
                    onChange={() => setSelectedId(item.orderItemId)}
                  />
                </label>
              );
            })}
          </div>
          <StickyActionBar>
            {selectedId && (
              <Button type="button" onClick={handleContinue}>
                Продолжить
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onReturnToList}>
              Отмена
            </Button>
          </StickyActionBar>
        </>
      )}

      {step === 'form' && selectedItem && (
        <>
          <h3>Оформление возврата</h3>
          <div className={styles.summary}>
            {summaryImage ? (
              <img className={styles.summaryImage} src={summaryImage} alt={selectedItem.title} />
            ) : (
              <div className={styles.imagePlaceholder} aria-hidden="true" />
            )}
            <div>
              <strong>{selectedItem.title}</strong>
              <p>{selectedItem.price.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>
          <div className={styles.section}>
            <p className={styles.label}>Причина возврата</p>
            <ReturnReasonRadioGroup value={reason} onChange={setReason} />
            {showErrors && fieldErrors.reason && <p className={styles.error}>{fieldErrors.reason}</p>}
          </div>
          <div className={styles.section}>
            <p className={styles.label}>Комментарий</p>
            <textarea
              value={comment}
              placeholder="Расскажите в деталях, что не так"
              onChange={(event) => setComment(event.target.value)}
            />
            {showErrors && fieldErrors.comment && <p className={styles.error}>{fieldErrors.comment}</p>}
          </div>
          <div className={styles.section}>
            <p className={styles.label}>
              Сделайте фото в хорошем качестве, по которым можно оценить состояние товара
            </p>
            <ReturnPhotoUploader files={files} onChange={setFiles} error={fieldErrors.photos} />
          </div>
          {formError && <p className={styles.error}>{formError}</p>}
          <StickyActionBar>
            <Button type="button" onClick={handleSubmit} disabled={submitting || !isFormValid}>
              Продолжить
            </Button>
            <Button type="button" variant="secondary" onClick={onReturnToList}>
              Отмена
            </Button>
          </StickyActionBar>
        </>
      )}
    </div>
  );
};
