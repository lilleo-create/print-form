import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../shared/api';
import { getProductImages } from '../shared/lib/productMedia';
import { toEditableProduct } from '../shared/lib/editableProduct';
import { Product } from '../shared/types';
import { Button } from '../shared/ui/Button';
import { SellerProductModal, SellerProductPayload } from '../widgets/seller/SellerProductModal';
import styles from './SellerProductDetailPage.module.css';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  }).format(value);

export const SellerProductDetailPage = () => {
  const { productId = '' } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const loadProduct = async () => {
    if (!productId) {
      setProduct(null);
      setError('Некорректная ссылка: productId не указан.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.getSellerProducts();
      const matched = response.data.find((item) => item.id === productId) ?? null;

      if (!matched) {
        setProduct(null);
        setError('Товар не найден в кабинете продавца.');
      } else {
        setProduct(matched);
      }
    } catch {
      setError('Не удалось загрузить товар. Попробуйте обновить страницу.');
      setProduct(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProduct();
  }, [productId]);

  const images = useMemo(() => getProductImages(product), [product]);
  const editableProduct = useMemo(() => toEditableProduct(product), [product]);
  useEffect(() => {
    setBrokenImages({});
  }, [images]);

  const handleSaveProduct = async (payload: SellerProductPayload) => {
    if (!product?.id) return;

    await api.updateSellerProduct(product.id, payload);
    setIsEditModalOpen(false);
    await loadProduct();
  };

  if (isLoading) {
    return (
      <section className={styles.page}>
        <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
        <div className={styles.skeletonGrid}>
          <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
          <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
        </div>
      </section>
    );
  }

  if (error || !product) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>{error ?? 'Товар не найден.'}</p>
        <Button type="button" variant="ghost" onClick={() => navigate('/seller')}>
          Вернуться в кабинет продавца
        </Button>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/seller" className={styles.backLink}>
          ← К товарам продавца
        </Link>
        <span className={styles.status}>{product.moderationStatus ?? '—'}</span>
      </div>

      <div className={styles.layout}>
        <div className={styles.mainInfo}>
          <h1>{editableProduct?.title ?? product.title}</h1>
          <p className={styles.description}>{editableProduct?.description ?? product.description}</p>

          <div className={styles.fieldsGrid}>
            <label>
              <span>Категория</span>
              <input value={editableProduct?.category ?? product.category} readOnly />
            </label>
            <label>
              <span>Материал</span>
              <input value={editableProduct?.material ?? product.material} readOnly />
            </label>
            <label>
              <span>Технология</span>
              <input value={editableProduct?.technology ?? product.technology} readOnly />
            </label>
            <label>
              <span>Цвет</span>
              <input value={editableProduct?.color ?? product.color} readOnly />
            </label>
            <label>
              <span>Цена</span>
              <input value={formatCurrency(editableProduct?.price ?? product.price)} readOnly />
            </label>
            <label>
              <span>Статус</span>
              <input value={product.moderationStatus ?? '—'} readOnly />
            </label>
            <label>
              <span>SKU</span>
              <input value={editableProduct?.sku || product.sku || '—'} readOnly />
            </label>
            <label>
              <span>ID продавца</span>
              <input value={product.sellerId ?? '—'} readOnly />
            </label>
          </div>

          {editableProduct?.characteristics?.length ? (
            <div className={styles.specs}>
              <h3>Характеристики</h3>
              <ul>
                {editableProduct.characteristics.map((spec) => (
                  <li key={spec.id}>
                    <span>{spec.key}</span>
                    <strong>{spec.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className={styles.muted}>Характеристики не заполнены.</p>
          )}
        </div>

        <aside className={styles.mediaInfo}>
          <h3>Изображения</h3>
          {images.length ? (
            <div className={styles.imagesGrid}>
              {images.map((url, index) => (
                brokenImages[url] ? (
                  <div key={`${url}-${index}`} className={styles.imagePlaceholder}>
                    Нет изображения
                  </div>
                ) : (
                  <img
                    key={`${url}-${index}`}
                    src={url}
                    alt={`${product.title} ${index + 1}`}
                    onError={() =>
                      setBrokenImages((prev) => ({ ...prev, [url]: true }))
                    }
                  />
                )
              ))}
            </div>
          ) : (
            <p className={styles.muted}>Изображения отсутствуют.</p>
          )}
        </aside>
      </div>

      <div className={styles.footerActions}>
        <Button type="button" onClick={() => setIsEditModalOpen(true)}>
          Редактировать товар
        </Button>
      </div>

      {isEditModalOpen && (
        <SellerProductModal
          product={product}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleSaveProduct}
        />
      )}
    </section>
  );
};
