import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../shared/api';
import { Product, ProductVariant } from '../shared/types';
import { Button } from '../shared/ui/Button';
import { SellerProductModal, SellerProductPayload } from '../widgets/seller/SellerProductModal';
import styles from './SellerProductDetailPage.module.css';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  }).format(value);

const getProductImages = (product: Product) => {
  if (product.images?.length) {
    return [...product.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => item.url);
  }

  if (product.imageUrls?.length) {
    return product.imageUrls;
  }

  return product.image ? [product.image] : [];
};

const getVariantPreview = (product: Product, variantIndex: number) => {
  const productImages = getProductImages(product);
  return productImages[variantIndex] ?? productImages[0] ?? '';
};

const extractVariantColor = (variant: ProductVariant) => {
  const colorOption = variant.options?.color?.[0];
  return colorOption ?? 'Без цвета';
};

export const SellerProductDetailPage = () => {
  const { productId = '' } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadProduct = async () => {
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

  const images = useMemo(() => (product ? getProductImages(product) : []), [product]);

  const handleSaveProduct = async (payload: SellerProductPayload) => {
    if (!product?.id) return;

    await api.updateSellerProduct(product.id, payload);
    setIsEditModalOpen(false);
    await loadProduct();
  };

  if (isLoading) {
    return <section className={styles.page}>Загрузка товара…</section>;
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

      {product.variants?.length ? (
        <div className={styles.variantsBlock}>
          <div className={styles.variantsHeader}>
            <h2>Варианты товара</h2>
            <span>Всего: {product.variants.length}</span>
          </div>
          <div className={styles.variantsRow}>
            {product.variants.map((variant, index) => (
              <article key={variant.id} className={styles.variantCard}>
                {getVariantPreview(product, index) ? (
                  <img
                    src={getVariantPreview(product, index)}
                    alt={variant.name}
                    className={styles.variantPreview}
                  />
                ) : (
                  <div className={styles.variantPlaceholder}>Нет фото</div>
                )}
                <strong>{variant.name}</strong>
                <span>{extractVariantColor(variant)}</span>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.mainInfo}>
          <h1>{product.title}</h1>
          <p className={styles.description}>{product.description}</p>

          <div className={styles.fieldsGrid}>
            <label>
              <span>Категория</span>
              <input value={product.category} readOnly />
            </label>
            <label>
              <span>Материал</span>
              <input value={product.material} readOnly />
            </label>
            <label>
              <span>Технология</span>
              <input value={product.technology} readOnly />
            </label>
            <label>
              <span>Цвет</span>
              <input value={product.color} readOnly />
            </label>
            <label>
              <span>Цена</span>
              <input value={formatCurrency(product.price)} readOnly />
            </label>
            <label>
              <span>Статус</span>
              <input value={product.moderationStatus ?? '—'} readOnly />
            </label>
            <label>
              <span>SKU</span>
              <input value={product.sku ?? '—'} readOnly />
            </label>
            <label>
              <span>ID продавца</span>
              <input value={product.sellerId ?? '—'} readOnly />
            </label>
          </div>

          {product.specs?.length ? (
            <div className={styles.specs}>
              <h3>Характеристики</h3>
              <ul>
                {product.specs.map((spec) => (
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
                <img key={`${url}-${index}`} src={url} alt={`${product.title} ${index + 1}`} />
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
