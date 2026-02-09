import { useMemo, useState } from 'react';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import { ReturnRequest } from '../../shared/types';
import { reasonLabels, statusLabels } from './returnLabels';
import { ReturnPhotos } from './ReturnPhotos';
import styles from './ReturnDetails.module.css';

interface ReturnDetailsProps {
  request: ReturnRequest;
}

const formatDate = (value?: string) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

export const ReturnDetails = ({ request }: ReturnDetailsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const requestItems = request.items ?? [];
  const firstItem = requestItems[0]?.orderItem;
  const product = firstItem?.product;
  const productTitle = product?.title ?? 'Товар';
  const productPrice = product?.price ?? firstItem?.priceAtPurchase ?? null;
  const productQuantity = requestItems[0]?.quantity ?? firstItem?.quantity ?? null;
  const productImage = resolveImageUrl(product?.image);

  const detailRows = useMemo(
    () => [
      { label: 'Причина', value: reasonLabels[request.reason] },
      { label: 'Комментарий', value: request.comment?.trim() || 'Комментарий не указан' },
      { label: 'Дата создания', value: formatDate(request.createdAt) },
      ...(request.updatedAt ? [{ label: 'Обновлено', value: formatDate(request.updatedAt) }] : []),
      ...(request.adminComment ? [{ label: 'Комментарий менеджера', value: request.adminComment }] : [])
    ],
    [request]
  );

  return (
    <div className={styles.details}>
      <div className={styles.product}>
        {productImage ? (
          <img className={styles.productImage} src={productImage} alt={productTitle} />
        ) : (
          <div className={styles.imagePlaceholder} aria-hidden="true" />
        )}
        <div className={styles.productInfo}>
          <p className={styles.productTitle}>{productTitle}</p>
          <div className={styles.productMeta}>
            {typeof productPrice === 'number' && (
              <span className={styles.productPrice}>{productPrice.toLocaleString('ru-RU')} ₽</span>
            )}
            {productQuantity && <span className={styles.productQuantity}>{productQuantity} шт.</span>}
          </div>
        </div>
      </div>

      <div className={styles.info}>
        <div>
          <p className={styles.label}>Статус</p>
          <p className={styles.value}>{statusLabels[request.status]}</p>
        </div>
        <div>
          <p className={styles.label}>Причина</p>
          <p className={styles.value}>{reasonLabels[request.reason]}</p>
        </div>
        <div>
          <p className={styles.label}>Дата</p>
          <p className={styles.value}>{formatDate(request.createdAt)}</p>
        </div>
      </div>

      <button type="button" className={styles.expandButton} onClick={() => setIsExpanded((prev) => !prev)}>
        {isExpanded ? 'Скрыть подробности' : 'Подробнее'}
      </button>

      {isExpanded && (
        <div className={styles.expanded}>
          <div className={styles.detailList}>
            {detailRows.map((row) => (
              <div key={row.label} className={styles.detailRow}>
                <span className={styles.detailLabel}>{row.label}</span>
                <span className={styles.detailValue}>{row.value}</span>
              </div>
            ))}
          </div>
          <ReturnPhotos photos={request.photos ?? []} />
        </div>
      )}
    </div>
  );
};
