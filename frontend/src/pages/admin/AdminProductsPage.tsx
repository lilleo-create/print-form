import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api';
import { Product } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import styles from './AdminPage.module.css';

type AdminProduct = Product & {
  seller?: { id: string; name: string; email: string } | null;
};

const statusOptions = ['PENDING', 'NEEDS_EDIT', 'REJECTED', 'APPROVED', 'ARCHIVED'] as const;
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('ru-RU') : '—');

export const AdminProductsPage = () => {
  const [status, setStatus] = useState<(typeof statusOptions)[number]>('PENDING');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminProduct | null>(null);
  const [notes, setNotes] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await api.getAdminProducts(status);
      setProducts(response.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [status]);

  const handleApprove = async (id: string) => {
    setActionId(id);
    try {
      await api.approveAdminProduct(id);
      setSelected(null);
      setNotes('');
      await loadProducts();
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string, reason: 'reject' | 'needs-edit') => {
    setActionId(id);
    try {
      if (reason === 'reject') {
        await api.rejectAdminProduct(id, { notes: notes || undefined });
      } else {
        await api.needsEditAdminProduct(id, { notes: notes || undefined });
      }
      setSelected(null);
      setNotes('');
      await loadProducts();
    } finally {
      setActionId(null);
    }
  };

  const handleArchive = async (id: string) => {
    setActionId(id);
    try {
      await api.archiveAdminProduct(id);
      setSelected(null);
      await loadProducts();
    } finally {
      setActionId(null);
    }
  };

  const rows = useMemo(() => products, [products]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Модерация товаров</h1>
          <p className={styles.muted}>Проверяйте карточки товаров перед публикацией.</p>
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
        <p className={styles.muted}>Загрузка товаров...</p>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>Товаров не найдено.</p>
      ) : (
        <div className={styles.table}>
          <div
            className={styles.tableHeader}
            style={{ gridTemplateColumns: 'minmax(200px, 1.6fr) 160px 160px 140px 160px' }}
          >
            <span>Товар</span>
            <span>Продавец</span>
            <span>Цена</span>
            <span>Статус</span>
            <span>Действия</span>
          </div>
          {rows.map((product) => (
            <div
              key={product.id}
              className={styles.tableRow}
              style={{ gridTemplateColumns: 'minmax(200px, 1.6fr) 160px 160px 140px 160px' }}
            >
              <div>
                <strong>{product.title}</strong>
                <div className={styles.muted}>{formatDate(product.updatedAt ?? product.createdAt)}</div>
              </div>
              <div>
                <div>{product.seller?.name ?? '—'}</div>
                <div className={styles.muted}>{product.seller?.email ?? ''}</div>
              </div>
              <span>{product.price.toLocaleString('ru-RU')} ₽</span>
              <span className={styles.status}>{product.moderationStatus ?? status}</span>
              <div className={styles.actions}>
                <Button
                  type="button"
                  onClick={() => {
                    setSelected(product);
                    setNotes(product.moderationNotes ?? '');
                  }}
                >
                  Подробнее
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>{selected.title}</h2>
            <p className={styles.muted}>{selected.description}</p>
            <div>
              <strong>Продавец:</strong> {selected.seller?.name ?? '—'} {selected.seller?.email ? `(${selected.seller.email})` : ''}
            </div>
            <div>
              <strong>Цена:</strong> {selected.price.toLocaleString('ru-RU')} ₽
            </div>
            <div>
              <strong>Категория:</strong> {selected.category}
            </div>
            <div className={styles.previewList}>
              {(selected.imageUrls ?? [selected.image])
                .filter((url): url is string => Boolean(url))
                .map((url, index) => (
                  <img key={`${url}-${index}`} src={url} alt={selected.title} />
                ))}
            </div>
            <label>
              Примечание
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
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
              <Button type="button" onClick={() => handleArchive(selected.id)} disabled={actionId === selected.id}>
                Архивировать
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
