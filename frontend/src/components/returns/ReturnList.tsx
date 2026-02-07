import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import { ReturnRequest } from '../../shared/types';
import styles from './ReturnList.module.css';

const statusLabels: Record<ReturnRequest['status'], string> = {
  CREATED: 'Создана',
  UNDER_REVIEW: 'На рассмотрении',
  APPROVED: 'Одобрена',
  REJECTED: 'Отклонена',
  REFUNDED: 'Возврат выполнен'
};

const reasonLabels: Record<ReturnRequest['reason'], string> = {
  NOT_FIT: 'Не подошло',
  DAMAGED: 'Брак или повреждение',
  WRONG_ITEM: 'Привезли не то'
};

interface ReturnListProps {
  items: ReturnRequest[];
  isLoading: boolean;
  error?: string | null;
}

export const ReturnList = ({ items, isLoading, error }: ReturnListProps) => {
  if (isLoading) {
    return <p className={styles.empty}>Загрузка возвратов...</p>;
  }
  if (error) {
    return <p className={styles.empty}>{error}</p>;
  }
  if (items.length === 0) {
    return <p className={styles.empty}>У вас пока нет возвратов.</p>;
  }

  return (
    <div className={styles.list}>
      {items.map((request) => {
        const requestItems = request.items ?? [];
        const requestPhotos = request.photos ?? [];
        const firstItem = requestItems[0]?.orderItem;
        const product = firstItem?.product;
        const productTitle = product?.title ?? 'Товар';
        const productPrice = product?.price ?? firstItem?.priceAtPurchase ?? null;
        const productImage = resolveImageUrl(product?.image);
        return (
          <article key={request.id} className={styles.card}>
            <div className={styles.meta}>
              <div>
                <strong>{statusLabels[request.status]}</strong>
                <p className={styles.reason}>{reasonLabels[request.reason]}</p>
                {request.comment && <p className={styles.comment}>{request.comment}</p>}
              </div>
              <span className={styles.date}>
                {new Date(request.createdAt).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div className={styles.product}>
              {productImage ? (
                <img className={styles.productImage} src={productImage} alt={productTitle} />
              ) : (
                <div className={styles.imagePlaceholder} aria-hidden="true" />
              )}
              <div className={styles.productInfo}>
                <p className={styles.productTitle}>{productTitle}</p>
                {typeof productPrice === 'number' && (
                  <span className={styles.productPrice}>{productPrice.toLocaleString('ru-RU')} ₽</span>
                )}
              </div>
            </div>
            {requestPhotos.length > 0 && (
              <div className={styles.photos}>
                {requestPhotos.map((photo) => (
                  <img key={photo.id} src={resolveImageUrl(photo.url)} alt="Фото возврата" />
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};
