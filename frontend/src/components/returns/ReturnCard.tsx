import { KeyboardEvent } from 'react';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import { ReturnRequest } from '../../shared/types';
import { reasonLabels, statusLabels } from './returnLabels';
import styles from './ReturnCard.module.css';

interface ReturnCardProps {
  request: ReturnRequest;
  onOpen: (request: ReturnRequest) => void;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

export const ReturnCard = ({ request, onOpen }: ReturnCardProps) => {
  const requestItems = request.items ?? [];
  const firstItem = requestItems[0]?.orderItem;
  const product = firstItem?.product;
  const productTitle = product?.title ?? 'Товар';
  const productPrice = product?.price ?? firstItem?.priceAtPurchase ?? null;
  const productImage = resolveImageUrl(product?.image);
  const productQuantity = requestItems[0]?.quantity ?? firstItem?.quantity ?? null;

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(request);
    }
  };

  return (
    <article
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(request)}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.meta}>
        <div>
          <strong className={styles.status}>{statusLabels[request.status]}</strong>
          <p className={styles.reason}>{reasonLabels[request.reason]}</p>
          {request.comment && <p className={styles.comment}>{request.comment}</p>}
        </div>
        <span className={styles.date}>{formatDate(request.createdAt)}</span>
      </div>
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
            {productQuantity && (
              <span className={styles.productQuantity}>{productQuantity} шт.</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
