import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { normalizeApiError } from '../../shared/api/client';
import type { Product, Shop } from '../../shared/types';
import type { Review } from '../../shared/types';
import type { ReviewSummary } from '../../hooks/useProductReviews';
import { Rating } from '../../shared/ui/Rating';
import styles from '../../pages/ProductPage.module.css';
import { formatReviewDate } from './utils';
import { resolveImageUrl } from '../../shared/lib/resolveImageUrl';
import { getProductPrimaryImage } from '../../shared/lib/getProductPrimaryImage';
import { getReviewAuthorName, normalizeReviewPhotoUrl, type ReviewPhotoLike } from '../../shared/lib/reviews';

type ProductReviewsPreviewProps = {
  productId: string;
  product: Product;
  reviews: Review[];
  summary: ReviewSummary | null;
};

const shopCache = new Map<string, Shop>();

export const ProductReviewsPreview = ({ productId, product, reviews, summary }: ProductReviewsPreviewProps) => {
  const reviewsCount = summary?.total ?? 0;
  const [shop, setShop] = useState<Shop | null>(null);
  const [isShopHidden, setIsShopHidden] = useState(false);
  const shopId = product.sellerId;
  const productImageSrc = resolveImageUrl(getProductPrimaryImage(product));

  useEffect(() => {
    if (!shopId) {
      setShop(null);
      setIsShopHidden(false);
      return;
    }
    const cached = shopCache.get(shopId);
    if (cached) {
      setShop(cached);
      setIsShopHidden(false);
      return;
    }
    const controller = new AbortController();
    api
      .getShop(shopId, { signal: controller.signal })
      .then((response) => {
        shopCache.set(shopId, response.data);
        setShop(response.data);
        setIsShopHidden(false);
      })
      .catch((error) => {
        const normalizedError = normalizeApiError(error);
        if (normalizedError.code === 'STORE_NOT_PUBLIC') {
          setIsShopHidden(true);
          setShop(null);
          return;
        }

        setShop(null);
      });

    return () => controller.abort();
  }, [shopId]);

  return (
    <div className={styles.reviewsPreview}>
      <div className={styles.reviewsHeader}>
        <div>
          <h2>Отзывы</h2>
          <p className={styles.reviewsHint}>Последние впечатления покупателей</p>
        </div>
        <Link to={`/product/${productId}/reviews`} className={styles.reviewLink}>
          Смотреть все отзывы
        </Link>
      </div>

      <div className={styles.reviewsContent}>
        <div className={styles.reviewsSummary}>
          <div className={styles.reviewProductPreview}>
            {productImageSrc ? (
              <img src={productImageSrc} alt={product.title} className={styles.reviewProductImage} />
            ) : (
              <div className={styles.reviewProductPlaceholder}>Нет изображения</div>
            )}
            <p className={styles.reviewProductTitle}>{product.title}</p>
          </div>
          <div className={styles.summaryTop}>
            <span className={styles.summaryValue}>
              {typeof summary?.avg === 'number' ? summary.avg.toFixed(1) : '0.0'}
            </span>
            <Rating value={summary?.avg ?? 0} count={reviewsCount} />
          </div>

          <ul>
            {(summary?.counts ?? [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 }))).map((item) => (
              <li key={item.rating}>
                <span>{item.rating}★</span>
                <div className={styles.bar}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: reviewsCount ? `${(item.count / reviewsCount) * 100}%` : '0%'
                    }}
                  />
                </div>
                <span>{item.count}</span>
              </li>
            ))}
          </ul>

          {shopId && !isShopHidden ? (
            <Link to={`/shop/${shopId}`} className={styles.shopBadge}>
              {shop?.avatarUrl ? (
                <img src={resolveImageUrl(shop.avatarUrl)} alt={shop.title} className={styles.shopBadgeAvatar} />
              ) : (
                <div className={styles.shopBadgeAvatar}>🏪</div>
              )}
              <div>
                <p className={styles.shopBadgeTitle}>{shop?.title ?? 'Магазин'}</p>
                <p className={styles.shopBadgeMeta}>Рейтинг {Number(shop?.rating ?? 0).toFixed(1)}</p>
              </div>
            </Link>
          ) : (
            <div className={`${styles.shopBadge} ${styles.shopBadgeDisabled}`}>
              <div className={styles.shopBadgeAvatar}>🏪</div>
              <div>
                <p className={styles.shopBadgeTitle}>
                  Информация о магазине временно недоступна
                </p>
              </div>
            </div>
          )}
        </div>

        <div className={styles.reviewList}>
          {reviews.length === 0 ? (
            <p className={styles.reviewsEmpty}>Пока нет отзывов.</p>
          ) : (
            reviews.map((review) => {
              const reviewData = review as Review & {
                pros?: string;
                cons?: string;
                comment?: string;
                photos?: ReviewPhotoLike[];
              };

              return (
                <article key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewTop}>
                  <div>
                    <strong>{getReviewAuthorName(review)}</strong>
                    <span className={styles.reviewDate}>{formatReviewDate(review.createdAt)}</span>
                  </div>
                  <Rating value={review.rating} count={0} />
                </div>

                <div className={styles.reviewBody}>
                  <p>
                    <strong>Достоинства:</strong> {reviewData.pros}
                  </p>
                  <p>
                    <strong>Недостатки:</strong> {reviewData.cons}
                  </p>
                  <p>
                    <strong>Комментарий:</strong> {reviewData.comment}
                  </p>
                </div>

                {(reviewData.photos?.length ?? 0) > 0 ? (
                  <div className={styles.reviewPhotos}>
                    {reviewData.photos!
                      .map((photo: ReviewPhotoLike) => normalizeReviewPhotoUrl(photo))
                      .filter(Boolean)
                      .map((photo: string, index: number) => (
                        <img
                          src={resolveImageUrl(photo)}
                          alt={`Фото отзыва ${index + 1}`}
                          key={`${photo}-${index}`}
                        />
                      ))}
                  </div>
                ) : null}
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
