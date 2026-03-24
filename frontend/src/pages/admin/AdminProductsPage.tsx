import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api';
import { Product } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Modal } from '../../shared/ui/Modal';
import { Table } from '../../shared/ui/Table';
import {
  getProductImages,
  getProductVideos
} from '../../shared/lib/productMedia';
import styles from './AdminPage.module.css';

type AdminProduct = Product & {
  seller?: { id: string; name: string; email: string } | null;
};

type ProductField = { label: string; value: string };

const statusOptions = [
  'PENDING',
  'NEEDS_EDIT',
  'REJECTED',
  'APPROVED',
  'ARCHIVED'
] as const;

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const formatPrice = (value?: number, currency?: string) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const currencyCode = currency || 'RUB';
  return `${value.toLocaleString('ru-RU')} ${currencyCode}`;
};

const toDisplayValue = (value: unknown) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.trim() || '—';
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : '—';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  return String(value);
};

const getVisibleDescriptions = (product: AdminProduct): ProductField[] => {
  const descriptions: ProductField[] = [
    {
      label: 'Краткое описание',
      value: toDisplayValue(product.descriptionShort)
    },
    {
      label: 'Полное описание',
      value: toDisplayValue(product.descriptionFull)
    },
    { label: 'Описание', value: toDisplayValue(product.description) }
  ];

  return descriptions.filter((item) => item.value !== '—');
};

export const AdminProductsPage = () => {
  const [status, setStatus] =
    useState<(typeof statusOptions)[number]>('PENDING');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(
    null
  );
  const [notes, setNotes] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<string[]>([]);

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

  const closeModal = () => {
    setSelectedProduct(null);
    setNotes('');
    setActiveImage(null);
    setBrokenImages([]);
  };

  const openModerationModal = (product: AdminProduct) => {
    setSelectedProduct(product);
    setNotes(product.moderationNotes ?? '');
    setBrokenImages([]);
  };

  const handleApprove = async (id: string) => {
    setActionId(id);
    try {
      await api.approveAdminProduct(id);
      closeModal();
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
      closeModal();
      await loadProducts();
    } finally {
      setActionId(null);
    }
  };

  const handleArchive = async (id: string) => {
    setActionId(id);
    try {
      await api.archiveAdminProduct(id);
      closeModal();
      await loadProducts();
    } finally {
      setActionId(null);
    }
  };

  const rows = useMemo(() => products, [products]);
  const imageUrls = useMemo(
    () => getProductImages(selectedProduct),
    [selectedProduct]
  );
  const videoUrls = useMemo(
    () => getProductVideos(selectedProduct),
    [selectedProduct]
  );

  useEffect(() => {
    if (!imageUrls.length) {
      setActiveImage(null);
      return;
    }

    if (!activeImage || !imageUrls.includes(activeImage)) {
      setActiveImage(imageUrls[0]);
    }
  }, [imageUrls, activeImage]);

  const visibleImageUrls = imageUrls.filter(
    (url) => !brokenImages.includes(url)
  );
  const previewImage =
    activeImage && !brokenImages.includes(activeImage)
      ? activeImage
      : (visibleImageUrls[0] ?? null);

  const productMeta: ProductField[] = selectedProduct
    ? [
        { label: 'Название', value: toDisplayValue(selectedProduct.title) },
        { label: 'SKU', value: toDisplayValue(selectedProduct.sku) },
        { label: 'Категория', value: toDisplayValue(selectedProduct.category) },
        {
          label: 'Цена',
          value: formatPrice(selectedProduct.price, selectedProduct.currency)
        },
        {
          label: 'Валюта',
          value: toDisplayValue(selectedProduct.currency || 'RUB')
        },
        {
          label: 'Статус',
          value: toDisplayValue(selectedProduct.moderationStatus || status)
        },
        { label: 'Создан', value: formatDate(selectedProduct.createdAt) },
        { label: 'Обновлён', value: formatDate(selectedProduct.updatedAt) },
        { label: 'Опубликован', value: formatDate(selectedProduct.publishedAt) }
      ]
    : [];

  const productSeller: ProductField[] = selectedProduct
    ? [
        {
          label: 'Имя продавца',
          value: toDisplayValue(selectedProduct.seller?.name)
        },
        {
          label: 'Email продавца',
          value: toDisplayValue(selectedProduct.seller?.email)
        },
        {
          label: 'Seller.id',
          value: toDisplayValue(selectedProduct.seller?.id)
        },
        { label: 'sellerId', value: toDisplayValue(selectedProduct.sellerId) }
      ]
    : [];

  const productSpecs: ProductField[] = selectedProduct
    ? [
        { label: 'Материал', value: toDisplayValue(selectedProduct.material) },
        {
          label: 'Технология',
          value: toDisplayValue(selectedProduct.technology)
        },
        { label: 'Цвет', value: toDisplayValue(selectedProduct.color) },
        {
          label: 'Время производства (ч)',
          value: toDisplayValue(selectedProduct.productionTimeHours)
        },
        {
          label: 'Вес брутто (г)',
          value: toDisplayValue(selectedProduct.weightGrossG)
        },
        { label: 'Размер X (см)', value: toDisplayValue(selectedProduct.dxCm) },
        { label: 'Размер Y (см)', value: toDisplayValue(selectedProduct.dyCm) },
        { label: 'Размер Z (см)', value: toDisplayValue(selectedProduct.dzCm) },
        {
          label: 'Средний рейтинг',
          value: toDisplayValue(selectedProduct.ratingAvg)
        },
        {
          label: 'Кол-во оценок',
          value: toDisplayValue(selectedProduct.ratingCount)
        },
        {
          label: 'Прогноз доставки',
          value: formatDate(selectedProduct.deliveryDateEstimated)
        }
      ]
    : [];

  const moderationFields: ProductField[] = selectedProduct
    ? [
        {
          label: 'Статус модерации',
          value: toDisplayValue(selectedProduct.moderationStatus)
        },
        {
          label: 'Примечания модерации',
          value: toDisplayValue(selectedProduct.moderationNotes)
        },
        { label: 'Проверен', value: formatDate(selectedProduct.moderatedAt) },
        {
          label: 'Проверил (ID)',
          value: toDisplayValue(selectedProduct.moderatedById)
        }
      ]
    : [];

  const descriptions = selectedProduct
    ? getVisibleDescriptions(selectedProduct)
    : [];

  const markImageBroken = (url: string) => {
    setBrokenImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Модерация товаров</h1>
          <p className={styles.muted}>
            Проверяйте карточки товаров перед публикацией.
          </p>
        </div>
        <div className={styles.filters}>
          <label>
            Статус
            <select
              className={styles.select}
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as (typeof statusOptions)[number])
              }
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
        <EmptyState
          title="Нет товаров"
          description="В выбранном статусе ничего не найдено."
        />
      ) : (
        <Table className={styles.table}>
          <div className={`${styles.tableHeader} ${styles.productColumns}`}>
            <span>Товар</span>
            <span>Продавец</span>
            <span>Цена</span>
            <span>Статус</span>
            <span>Действия</span>
          </div>
          {rows.map((product) => (
            <div
              key={product.id}
              className={`${styles.tableRow} ${styles.productColumns}`}
            >
              <div>
                <strong>{product.title}</strong>
                <div className={styles.muted}>
                  {formatDate(product.updatedAt ?? product.createdAt)}
                </div>
              </div>
              <div>
                <div className={styles.cellTruncate}>
                  {product.seller?.name ?? '—'}
                </div>
                <div className={`${styles.muted} ${styles.cellTruncate}`}>
                  {product.seller?.email ?? ''}
                </div>
              </div>
              <span>{product.price.toLocaleString('ru-RU')} ₽</span>
              <span className={styles.status}>
                {product.moderationStatus ?? status}
              </span>
              <div className={styles.actions}>
                <Button
                  type="button"
                  onClick={() => openModerationModal(product)}
                >
                  Подробнее
                </Button>
              </div>
            </div>
          ))}
        </Table>
      )}

      <Modal
        isOpen={Boolean(selectedProduct)}
        onClose={actionId ? undefined : closeModal}
        className={styles.modal}
      >
        {selectedProduct ? (
          <>
            <div className={styles.modalHeader}>
              <h2>{selectedProduct.title}</h2>
              <p className={styles.muted}>ID: {selectedProduct.id}</p>
            </div>

            <div className={styles.modalContent}>
              <section className={styles.mediaSection}>
                <h3>Медиа</h3>
                {previewImage ? (
                  <div className={styles.mainMediaWrap}>
                    <img
                      className={styles.mainMedia}
                      src={previewImage}
                      alt={selectedProduct.title}
                      onError={() => markImageBroken(previewImage)}
                    />
                    <div className={styles.mediaActions}>
                      <a href={previewImage} target="_blank" rel="noreferrer">
                        Открыть
                      </a>
                      <a
                        href={previewImage}
                        download
                        target="_blank"
                        rel="noreferrer"
                      >
                        Скачать
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className={styles.imagePlaceholder}>
                    Изображения отсутствуют
                  </div>
                )}

                {visibleImageUrls.length > 1 ? (
                  <div className={styles.thumbGrid}>
                    {visibleImageUrls.map((url) => (
                      <button
                        key={url}
                        type="button"
                        className={`${styles.thumbButton} ${url === previewImage ? styles.thumbActive : ''}`}
                        onClick={() => setActiveImage(url)}
                      >
                        <img
                          src={url}
                          alt="Миниатюра товара"
                          onError={() => markImageBroken(url)}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}

                {videoUrls.length > 0 ? (
                  <div className={styles.videoSection}>
                    <h4>Видео</h4>
                    {videoUrls.map((url) => (
                      <article key={url} className={styles.videoCard}>
                        <video
                          controls
                          preload="metadata"
                          src={url}
                          className={styles.videoPlayer}
                        />
                        <div className={styles.mediaActions}>
                          <a href={url} target="_blank" rel="noreferrer">
                            Открыть
                          </a>
                          <a
                            href={url}
                            download
                            target="_blank"
                            rel="noreferrer"
                          >
                            Скачать
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className={styles.infoSection}>
                <div className={styles.sectionCard}>
                  <h3>Основное</h3>
                  <dl className={styles.definitionList}>
                    {productMeta.map((field) => (
                      <div key={field.label} className={styles.definitionRow}>
                        <dt>{field.label}</dt>
                        <dd>{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className={styles.sectionCard}>
                  <h3>Продавец</h3>
                  <dl className={styles.definitionList}>
                    {productSeller.map((field) => (
                      <div key={field.label} className={styles.definitionRow}>
                        <dt>{field.label}</dt>
                        <dd>{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {descriptions.length > 0 ? (
                  <div className={styles.sectionCard}>
                    <h3>Описания</h3>
                    <div className={styles.descriptionList}>
                      {descriptions.map((field) => (
                        <article
                          key={field.label}
                          className={styles.descriptionCard}
                        >
                          <h4>{field.label}</h4>
                          <p>{field.value}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className={styles.sectionCard}>
                  <h3>Характеристики</h3>
                  <div className={styles.specGrid}>
                    {productSpecs.map((field) => (
                      <article key={field.label} className={styles.specCard}>
                        <h4>{field.label}</h4>
                        <p>{field.value}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className={styles.sectionCard}>
                  <h3>Модерация</h3>
                  <dl className={styles.definitionList}>
                    {moderationFields.map((field) => (
                      <div key={field.label} className={styles.definitionRow}>
                        <dt>{field.label}</dt>
                        <dd>{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>
            </div>

            <label className={styles.notesField}>
              Примечание модератора
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>

            <div className={styles.modalActions}>
              <Button
                type="button"
                onClick={() => handleApprove(selectedProduct.id)}
                disabled={actionId === selectedProduct.id}
              >
                Одобрить
              </Button>
              <Button
                type="button"
                onClick={() => handleReject(selectedProduct.id, 'needs-edit')}
                disabled={actionId === selectedProduct.id}
              >
                Нужны правки
              </Button>
              <Button
                type="button"
                onClick={() => handleReject(selectedProduct.id, 'reject')}
                disabled={actionId === selectedProduct.id}
              >
                Отклонить
              </Button>
              <Button
                type="button"
                onClick={() => handleArchive(selectedProduct.id)}
                disabled={actionId === selectedProduct.id}
              >
                Архивировать
              </Button>
              <Button
                type="button"
                onClick={closeModal}
                disabled={actionId === selectedProduct.id}
              >
                Закрыть
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
};
