import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api';
import { SellerKycSubmission } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Table } from '../../shared/ui/Table';
import styles from './AdminPage.module.css';

const statusOptions = ['PENDING', 'APPROVED', 'REJECTED', 'REVISION'] as const;

type KycModerationStatus = 'APPROVED' | 'REJECTED' | 'REVISION';

export const AdminKycPage = () => {
  const [status, setStatus] = useState<(typeof statusOptions)[number]>('PENDING');
  const [submissions, setSubmissions] = useState<SellerKycSubmission[]>([]);
  const [selected, setSelected] = useState<SellerKycSubmission | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
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

  const openDetails = async (id: string) => {
    setModalLoading(true);
    try {
      const response = await api.getAdminKycById(id);
      const details = response.data;
      setSelected(details);
      setComment(details.comment ?? details.moderationNotes ?? details.notes ?? '');
    } finally {
      setModalLoading(false);
    }
  };

  const closeDetails = () => {
    setSelected(null);
    setComment('');
  };

  const handleModeration = async (nextStatus: KycModerationStatus) => {
    if (!selected) return;
    setActionId(selected.id);
    try {
      await api.updateAdminKycStatus(selected.id, { status: nextStatus, comment: comment.trim() || undefined });
      await loadSubmissions();
      await openDetails(selected.id);
    } finally {
      setActionId(null);
    }
  };

  const handleDownload = async (docId: string, fallbackName?: string) => {
    try {
      const { blob, filename } = await api.downloadAdminSellerDocument(docId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || fallbackName || 'document';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDownloadError('');
    } catch {
      setDownloadError('Не удалось скачать документ.');
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
        <EmptyState title="Нет заявок" description="Заявки в выбранном статусе не найдены." />
      ) : (
        <Table className={styles.table}>
          <div
            className={styles.tableHeader}
            style={{ gridTemplateColumns: 'minmax(180px, 1.4fr) 140px 140px minmax(220px, 1.6fr) 220px' }}
          >
            <span>Пользователь</span>
            <span>Создана</span>
            <span>Статус</span>
            <span>Документы</span>
            <span>Детали</span>
          </div>
          {rows.map((submission) => (
            <div
              key={submission.id}
              className={styles.tableRow}
              style={{ gridTemplateColumns: 'minmax(180px, 1.4fr) 140px 140px minmax(220px, 1.6fr) 220px', cursor: 'pointer' }}
              onClick={() => openDetails(submission.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openDetails(submission.id);
                }
              }}
            >
              <div>
                <strong className={styles.cellTruncate}>{submission.user?.name ?? submission.userId}</strong>
                <div className={`${styles.muted} ${styles.cellTruncate}`}>{submission.user?.email ?? '—'}</div>
              </div>
              <span>{new Date(submission.createdAt).toLocaleDateString('ru-RU')}</span>
              <span className={styles.status}>{submission.status}</span>
              <div className={styles.previewList}>
                {submission.documents?.length ? (
                  <span>{submission.documents.length} файл(ов)</span>
                ) : (
                  <span className={styles.muted}>Документы не загружены.</span>
                )}
              </div>
              <div className={styles.actions}>
                <Button type="button" onClick={(e) => { e.stopPropagation(); openDetails(submission.id); }}>
                  Открыть
                </Button>
              </div>
            </div>
          ))}
        </Table>
      )}
      {downloadError && <p className={styles.errorText}>{downloadError}</p>}

      {(selected || modalLoading) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            {modalLoading || !selected ? (
              <p className={styles.muted}>Загрузка заявки...</p>
            ) : (
              <>
                <h2>KYC заявка</h2>
                <p className={styles.muted}>ID: {selected.id}</p>

                <h3>Merchant data</h3>
                <pre>{JSON.stringify(selected.merchantData ?? {}, null, 2)}</pre>

                <h3>Dropoff PVZ</h3>
                <p>dropoffPvzId: {selected.dropoffPvzId ?? '—'}</p>
                <pre>{JSON.stringify(selected.dropoffPvzMeta ?? {}, null, 2)}</pre>

                <h3>Документы</h3>
                {selected.documents?.length ? (
                  selected.documents.map((doc) => (
                    <div key={doc.id} className={styles.previewRow}>
                      <span>{doc.originalName}</span>
                      <div className={styles.previewActions}>
                        <Button type="button" onClick={() => handleDownload(doc.id, doc.originalName)}>
                          Скачать
                        </Button>
                        <a className={styles.link} href={doc.url} target="_blank" rel="noreferrer">
                          Открыть
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={styles.muted}>Документы не загружены.</p>
                )}

                <label>
                  Комментарий администратора
                  <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
                </label>

                <div className={styles.modalActions}>
                  <Button type="button" onClick={() => handleModeration('APPROVED')} disabled={actionId === selected.id}>
                    APPROVED
                  </Button>
                  <Button type="button" onClick={() => handleModeration('REJECTED')} disabled={actionId === selected.id}>
                    REJECTED
                  </Button>
                  <Button type="button" onClick={() => handleModeration('REVISION')} disabled={actionId === selected.id}>
                    REVISION
                  </Button>
                  <Button type="button" onClick={closeDetails} disabled={actionId === selected.id}>
                    Закрыть
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
