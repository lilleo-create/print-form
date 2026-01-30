import { useEffect, useState } from 'react';
import { api } from '../shared/api';
import { SellerKycSubmission } from '../shared/types';
import { Button } from '../shared/ui/Button';
import styles from './AdminKycPage.module.css';

export const AdminKycPage = () => {
  const [submissions, setSubmissions] = useState<SellerKycSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const loadSubmissions = async () => {
    try {
      const response = await api.getAdminKyc();
      setSubmissions(response.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setReviewingId(id);
    try {
      await api.reviewAdminKyc(id, { status, notes: notes[id] });
      setSubmissions((prev) => prev.filter((item) => item.id !== id));
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <section className={styles.page}>
      <div className="container">
        <header className={styles.header}>
          <h1>Проверка KYC</h1>
          <p>Управляйте заявками на верификацию продавцов.</p>
        </header>
        {loading ? (
          <p className={styles.muted}>Загрузка заявок...</p>
        ) : submissions.length === 0 ? (
          <p className={styles.muted}>Нет заявок на проверку.</p>
        ) : (
          <div className={styles.list}>
            {submissions.map((submission) => (
              <article key={submission.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3>Заявка #{submission.id}</h3>
                    <p className={styles.muted}>
                      {submission.user?.name ?? submission.userId} · {submission.user?.email ?? '—'}
                    </p>
                  </div>
                  <span className={styles.status}>{submission.status}</span>
                </div>
                <div className={styles.docs}>
                  {submission.documents?.length ? (
                    submission.documents.map((doc) => (
                      <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer">
                        {doc.originalName}
                      </a>
                    ))
                  ) : (
                    <span className={styles.muted}>Документы не загружены.</span>
                  )}
                </div>
                <label className={styles.notes}>
                  Примечание
                  <textarea
                    value={notes[submission.id] ?? ''}
                    onChange={(event) =>
                      setNotes((prev) => ({ ...prev, [submission.id]: event.target.value }))
                    }
                  />
                </label>
                <div className={styles.actions}>
                  <Button
                    type="button"
                    onClick={() => handleReview(submission.id, 'APPROVED')}
                    disabled={reviewingId === submission.id}
                  >
                    Одобрить
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleReview(submission.id, 'REJECTED')}
                    disabled={reviewingId === submission.id}
                  >
                    Отклонить
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
