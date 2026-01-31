import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api';
import { SellerKycSubmission } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import styles from './AdminPage.module.css';

const statusOptions = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export const AdminKycPage = () => {
  const [status, setStatus] = useState<(typeof statusOptions)[number]>('PENDING');
  const [submissions, setSubmissions] = useState<SellerKycSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const response = await api.getAdminKyc(status);
      setSubmissions(response.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [status]);

  const handleApprove = async (id: string) => {
    setActionId(id);
    try {
      await api.approveAdminKyc(id);
      await loadSubmissions();
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    setActionId(rejectingId);
    try {
      await api.rejectAdminKyc(rejectingId, { notes: rejectNotes || undefined });
      setRejectingId(null);
      setRejectNotes('');
      await loadSubmissions();
    } finally {
      setActionId(null);
    }
  };

  const rows = useMemo(() => submissions, [submissions]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>KYC модерация</h1>
          <p className={styles.muted}>Управляйте заявками на верификацию продавцов.</p>
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
        <p className={styles.muted}>Загрузка заявок...</p>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>Заявки не найдены.</p>
      ) : (
        <div className={styles.table}>
          <div
            className={styles.tableHeader}
            style={{ gridTemplateColumns: 'minmax(180px, 1.4fr) 140px 140px minmax(220px, 1.6fr) 220px' }}
          >
            <span>Пользователь</span>
            <span>Создана</span>
            <span>Статус</span>
            <span>Документы</span>
            <span>Действия</span>
          </div>
          {rows.map((submission) => (
            <div
              key={submission.id}
              className={styles.tableRow}
              style={{ gridTemplateColumns: 'minmax(180px, 1.4fr) 140px 140px minmax(220px, 1.6fr) 220px' }}
            >
              <div>
                <strong>{submission.user?.name ?? submission.userId}</strong>
                <div className={styles.muted}>{submission.user?.email ?? '—'}</div>
              </div>
              <span>{new Date(submission.createdAt).toLocaleDateString('ru-RU')}</span>
              <span className={styles.status}>{submission.status}</span>
              <div className={styles.previewList}>
                {submission.documents?.length ? (
                  submission.documents.map((doc) => (
                    <a key={doc.id} className={styles.link} href={doc.url} target="_blank" rel="noreferrer">
                      {doc.originalName}
                    </a>
                  ))
                ) : (
                  <span className={styles.muted}>Документы не загружены.</span>
                )}
              </div>
              <div className={styles.actions}>
                <Button type="button" onClick={() => handleApprove(submission.id)} disabled={actionId === submission.id}>
                  Одобрить
                </Button>
                <Button type="button" onClick={() => setRejectingId(submission.id)} disabled={actionId === submission.id}>
                  Отклонить
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectingId && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Отклонить заявку</h2>
            <p className={styles.muted}>Добавьте комментарий для продавца.</p>
            <textarea value={rejectNotes} onChange={(event) => setRejectNotes(event.target.value)} />
            <div className={styles.modalActions}>
              <Button type="button" onClick={handleReject} disabled={actionId === rejectingId}>
                Подтвердить
              </Button>
              <Button type="button" onClick={() => setRejectingId(null)} disabled={actionId === rejectingId}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
