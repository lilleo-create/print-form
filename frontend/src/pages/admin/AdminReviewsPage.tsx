import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api';
import { Review } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Table } from '../../shared/ui/Table';
import styles from './AdminPage.module.css';

type AdminReview = Review & {
  user?: { id: string; name: string; email?: string } | null;
  product?: { id: string; title: string; image?: string } | null;
};

const statusOptions = ['PENDING', 'NEEDS_EDIT', 'REJECTED', 'APPROVED'] as const;

export const AdminReviewsPage = () => {
  const [status, setStatus] = useState<(typeof statusOptions)[number]>('PENDING');
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminReview | null>(null);
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const response = await api.getAdminReviews(status);
      setReviews(response.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [status]);

  const handleApprove = async (id: string) => {
    setActionId(id);
    try {
      await api.approveAdminReview(id);
      setSelected(null);
      setNotes('');
      await loadReviews();
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string, reason: 'reject' | 'needs-edit') => {
    const trimmed = notes.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      setNotesError('Укажите причину длиной от 10 до 500 символов.');
      return;
    }
    setActionId(id);
    try {
      if (reason === 'reject') {
        await api.rejectAdminReview(id, { notes: trimmed });
      } else {
        await api.needsEditAdminReview(id, { notes: trimmed });
      }
      setSelected(null);
      setNotes('');
      setNotesError('');
      await loadReviews();
    } finally {
      setActionId(null);
    }
  };

  const rows = useMemo(() => reviews, [reviews]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Модерация отзывов</h1>
          <p className={styles.muted}>Публикуйте только одобренные отзывы.</p>
        </div>
        <div className={styles.filters}>
          <label>
            Статус
            <select
              className={styles.select}
              value={status}
              onChange={(event) => setStatus(event.target.value as (typeof statusOptions)[number])}
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <p className={styles.muted}>Загрузка отзывов...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Нет отзывов" description="Отзывы в выбранном статусе отсутствуют." />
      ) : (
        <Table className={styles.table}>
          <div
            className={styles.tableHeader}
            style={{ gridTemplateColumns: 'minmax(200px, 1.6fr) 160px 80px 200px 140px' }}
          >
            <span>Товар</span>
            <span>Автор</span>
            <span>Рейтинг</span>
            <span>Комментарий</span>
            <span>Действия</span>
          </div>
          {rows.map((review) => (
            <div
              key={review.id}
              className={styles.tableRow}
              style={{ gridTemplateColumns: 'minmax(200px, 1.6fr) 160px 80px 200px 140px' }}
            >
              <div>
                <strong>{review.product?.title ?? review.productId ?? '—'}</strong>
                <div className={styles.muted}>{new Date(review.createdAt).toLocaleDateString('ru-RU')}</div>
              </div>
              <div>
                <div className={styles.cellTruncate}>{review.user?.name ?? '—'}</div>
                <div className={`${styles.muted} ${styles.cellTruncate}`}>{review.user?.email ?? ''}</div>
              </div>
              <span>{review.rating}</span>
              <span className={styles.muted}>{review.comment.slice(0, 60)}...</span>
              <div className={styles.actions}>
                <Button
                  type="button"
                  onClick={() => {
                    setSelected(review);
                    setNotes(review.moderationNotes ?? '');
                    setNotesError('');
                  }}
                >
                  Подробнее
                </Button>
              </div>
            </div>
          ))}
        </Table>
      )}

      {selected && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Отзыв</h2>
            <p>
              <strong>Товар:</strong> {selected.product?.title ?? selected.productId}
            </p>
            <p>
              <strong>Автор:</strong> {selected.user?.name ?? '—'} {selected.user?.email ? `(${selected.user.email})` : ''}
            </p>
            <p>
              <strong>Рейтинг:</strong> {selected.rating}
            </p>
            <p>{selected.comment}</p>
            {selected.photos?.length ? (
              <div className={styles.previewList}>
                {selected.photos.map((url, index) => (
                  <img key={`${url}-${index}`} src={url} alt="Review" />
                ))}
              </div>
            ) : null}
            <label>
              Причина
              <textarea
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setNotesError('');
                }}
              />
            </label>
            {notesError && <p className={styles.errorText}>{notesError}</p>}
            <div className={styles.modalActions}>
              <Button type="button" onClick={() => handleApprove(selected.id)} disabled={actionId === selected.id}>
                Одобрить
              </Button>
              <Button
                type="button"
                onClick={() => handleReject(selected.id, 'needs-edit')}
                disabled={actionId === selected.id}
              >
                Нужны правки
              </Button>
              <Button type="button" onClick={() => handleReject(selected.id, 'reject')} disabled={actionId === selected.id}>
                Отклонить
              </Button>
              <Button type="button" onClick={() => setSelected(null)} disabled={actionId === selected.id}>
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
