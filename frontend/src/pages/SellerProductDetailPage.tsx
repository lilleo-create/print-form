import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../shared/api';
import { Product, ProductVariant } from '../shared/types';
import { Button } from '../shared/ui/Button';
import { SellerProductModal, SellerProductPayload } from '../widgets/seller/SellerProductModal';
import { sellerProductVariantsService } from '../shared/api/sellerProductVariantsService';
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

const extractVariantColor = (variant: ProductVariant) => {
  const colorOption = variant.options?.color?.[0];
  return colorOption ?? 'Без цвета';
};

const isVariantEditable = (product: Product) =>
  Boolean(product.id) && (product.moderationStatus === 'APPROVED' || Boolean(product.publishedAt));

export const SellerProductDetailPage = () => {
  const { productId = '' } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string>('base');
  const [variantForm, setVariantForm] = useState({
    name: '',
    color: '',
    sku: '',
    stock: '',
    priceDelta: '',
  });
  const [variantError, setVariantError] = useState<string | null>(null);
  const [isVariantBusy, setIsVariantBusy] = useState(false);

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
        setVariants(matched.variants ?? []);
        setActiveVariantId('base');
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
  const activeVariant = useMemo(
    () => variants.find((variant) => variant.id === activeVariantId) ?? null,
    [variants, activeVariantId]
  );

  useEffect(() => {
    if (!activeVariant) {
      setVariantForm({
        name: '',
        color: '',
        sku: '',
        stock: '',
        priceDelta: '',
      });
      return;
    }

    setVariantForm({
      name: activeVariant.name,
      color: extractVariantColor(activeVariant),
      sku: activeVariant.sku ?? '',
      stock: activeVariant.stock !== undefined ? String(activeVariant.stock) : '',
      priceDelta:
        activeVariant.priceDelta !== undefined
          ? String(activeVariant.priceDelta)
          : '',
    });
  }, [activeVariant]);

  const reloadVariants = async () => {
    if (!product?.id) return;
    const response = await sellerProductVariantsService.list(product.id);
    setVariants(response.data);
  };

  const handleSaveProduct = async (payload: SellerProductPayload) => {
    if (!product?.id) return;

    await api.updateSellerProduct(product.id, payload);
    setIsEditModalOpen(false);
    await loadProduct();
  };

  const handleAddVariant = async () => {
    if (!product?.id) return;
    setVariantError(null);
    setIsVariantBusy(true);
    try {
      const created = await sellerProductVariantsService.create(product.id, {
        name: `Вариант ${variants.length + 1}`,
        options: { color: [product.color] },
      });
      await reloadVariants();
      setActiveVariantId(created.data.id);
    } catch {
      setVariantError('Не удалось добавить вариант. Проверьте готовность backend API.');
    } finally {
      setIsVariantBusy(false);
    }
  };

  const handleSaveVariant = async () => {
    if (!product?.id || !activeVariant) return;
    setVariantError(null);
    setIsVariantBusy(true);
    try {
      await sellerProductVariantsService.update(product.id, activeVariant.id, {
        name: variantForm.name.trim() || activeVariant.name,
        sku: variantForm.sku.trim() || undefined,
        stock: variantForm.stock.trim() ? Number(variantForm.stock) : undefined,
        priceDelta: variantForm.priceDelta.trim()
          ? Number(variantForm.priceDelta)
          : undefined,
        options: variantForm.color.trim()
          ? { ...(activeVariant.options ?? {}), color: [variantForm.color.trim()] }
          : activeVariant.options,
      });
      await reloadVariants();
    } catch {
      setVariantError('Не удалось сохранить вариант.');
    } finally {
      setIsVariantBusy(false);
    }
  };

  const handleDeleteVariant = async () => {
    if (!product?.id || !activeVariant) return;
    setVariantError(null);
    setIsVariantBusy(true);
    try {
      await sellerProductVariantsService.remove(product.id, activeVariant.id);
      await reloadVariants();
      setActiveVariantId('base');
    } catch {
      setVariantError('Не удалось удалить вариант.');
    } finally {
      setIsVariantBusy(false);
    }
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

      {isVariantEditable(product) ? (
        <div className={styles.variantsBlock}>
          <div className={styles.variantsHeader}>
            <h2>Варианты товара</h2>
            <Button type="button" variant="secondary" onClick={handleAddVariant} disabled={isVariantBusy}>
              Добавить вариант
            </Button>
          </div>
          <div className={styles.variantsRow}>
            <button
              type="button"
              className={`${styles.variantPill} ${activeVariantId === 'base' ? styles.variantPillActive : ''}`}
              onClick={() => setActiveVariantId('base')}
            >
              Базовый товар
            </button>
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className={`${styles.variantPill} ${activeVariantId === variant.id ? styles.variantPillActive : ''}`}
                onClick={() => setActiveVariantId(variant.id)}
              >
                {variant.name}
              </button>
            ))}
          </div>
          {activeVariant ? (
            <div className={styles.variantEditor}>
              <label>
                Название
                <input value={variantForm.name} onChange={(event) => setVariantForm((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label>
                Цвет
                <input value={variantForm.color} onChange={(event) => setVariantForm((prev) => ({ ...prev, color: event.target.value }))} />
              </label>
              <label>
                SKU
                <input value={variantForm.sku} onChange={(event) => setVariantForm((prev) => ({ ...prev, sku: event.target.value }))} />
              </label>
              <label>
                Остаток
                <input value={variantForm.stock} onChange={(event) => setVariantForm((prev) => ({ ...prev, stock: event.target.value }))} />
              </label>
              <label>
                Δ цены
                <input value={variantForm.priceDelta} onChange={(event) => setVariantForm((prev) => ({ ...prev, priceDelta: event.target.value }))} />
              </label>
              <div className={styles.variantActions}>
                <Button type="button" onClick={handleSaveVariant} disabled={isVariantBusy}>
                  Сохранить вариант
                </Button>
                <Button type="button" variant="secondary" onClick={handleDeleteVariant} disabled={isVariantBusy}>
                  Удалить вариант
                </Button>
              </div>
            </div>
          ) : (
            <p className={styles.muted}>Выбран базовый товар. Для него варианты не редактируются.</p>
          )}
          {variantError ? <p className={styles.error}>{variantError}</p> : null}
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
