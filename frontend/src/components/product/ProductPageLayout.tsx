import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import type { Product } from '../../shared/types';
import styles from '../../pages/ProductPage.module.css';
import { useProduct } from '../../hooks/useProduct';
import { useProductReviews } from '../../hooks/useProductReviews';
import { useProductBoard } from '../../hooks/useProductBoard';
import { toProductImageList } from '../../shared/lib/productMedia';
import { ProductGallery } from './ProductGallery';
import { ProductDetails } from './ProductDetails';
import { ProductPurchasePanel } from './ProductPurchasePanel';
import { ProductReviewsPreview } from './ProductReviewsPreview';
import { ProductFeed } from './ProductFeed';
import { type SpecItem } from '../../pages/ProductPage/components/ProductSpecs/ProductSpecs';
import { api } from '../../shared/api';
import { getProductGroupKey, getProductVariants } from '../../shared/lib/productGrouping';
import { normalizeProductSpecs } from '../../shared/lib/productSpecs';
import { normalizeProductDtoList } from '../../shared/lib/normalizeProductDto';
import { formatPrice } from '../../utils/money';
import { PageLoader } from '../../shared/ui/PageLoader';

type ProductPageLayoutProps = {
  productId: string;
};

export const ProductPageLayout = ({ productId }: ProductPageLayoutProps) => {
  const navigate = useNavigate();
  const { data: product, status, error } = useProduct(productId, { keepPreviousData: false });
  const [variantProducts, setVariantProducts] = useState<Product[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string>(productId);
  const [specsExpanded, setSpecsExpanded] = useState(false);

  useEffect(() => {
    document.body.classList.add('hide-bottom-nav');
    return () => document.body.classList.remove('hide-bottom-nav');
  }, []);

  useEffect(() => {
    setActiveVariantId(productId);
  }, [productId]);

  useEffect(() => {
    if (!product || !product.sellerId || !getProductGroupKey(product)) {
      setVariantProducts([]);
      return;
    }

    let isMounted = true;
    api
      .getProducts({ shopId: product.sellerId, limit: 200, sort: 'createdAt', order: 'desc' })
      .then((response) => {
        if (!isMounted) return;
        const list = normalizeProductDtoList(response.data);
        setVariantProducts(getProductVariants(product, [product, ...list]));
      })
      .catch(() => {
        if (!isMounted) return;
        setVariantProducts([product]);
      });

    return () => {
      isMounted = false;
    };
  }, [product]);

  const activeProduct = useMemo(() => {
    if (!product) return null;
    if (!variantProducts.length) return product;
    return variantProducts.find((item) => item.id === activeVariantId) ?? product;
  }, [activeVariantId, product, variantProducts]);

  useEffect(() => {
    setSpecsExpanded(false);
  }, [activeProduct?.id]);

  const { reviews, summary } = useProductReviews(activeProduct?.id ?? productId, { keepPreviousData: false });

  useProductBoard(activeProduct);

  const specs = useMemo<SpecItem[]>(() => normalizeProductSpecs(activeProduct), [activeProduct]);
  const seoTitle = activeProduct
    ? `${activeProduct.title} — купить на PrintForm`
    : 'Товар — PrintForm';
  const seoDescription = activeProduct
    ? `${activeProduct.descriptionShort || activeProduct.description || ''}`.slice(0, 160)
    : 'Товар из каталога PrintForm.';
  const canonicalUrl = activeProduct ? `https://print-form.ru/product/${activeProduct.id}` : `https://print-form.ru/product/${productId}`;

  if (status === 'loading' && !product) {
    return (
      <section className={styles.page}>
        <Helmet>
          <title>{seoTitle}</title>
          <meta name="description" content={seoDescription} />
          <link rel="canonical" href={canonicalUrl} />
        </Helmet>
        <PageLoader />
      </section>
    );
  }

  if (!activeProduct) {
    return (
      <section className={styles.page}>
        <Helmet>
          <title>{seoTitle}</title>
          <meta name="description" content={seoDescription} />
          <link rel="canonical" href={canonicalUrl} />
        </Helmet>
        <div className={styles.container}>
          <p>{error ?? 'Товар не найден.'}</p>
        </div>
      </section>
    );
  }

  const productImages = toProductImageList(activeProduct);
  const reviewsCount = summary?.total ?? 0;

  return (
    <section className={styles.page}>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:type" content="product" />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Навигация">
          <Link to="/">Главная</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <Link to="/catalog">Каталог</Link>
          {activeProduct.category ? (
            <>
              <span className={styles.breadcrumbSep}>›</span>
              <Link to={`/catalog?category=${encodeURIComponent(activeProduct.category)}`}>
                {activeProduct.category}
              </Link>
            </>
          ) : null}
          <span className={styles.breadcrumbSep}>›</span>
          <span className={styles.breadcrumbCurrent}>{activeProduct.title}</span>
        </nav>

        {/* Mobile: back button above gallery */}
        <div className={styles.mobileTopBar}>
          <button
            type="button"
            className={styles.mobileBackBtn}
            onClick={() => navigate(-1)}
            aria-label="Назад"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        <div className={styles.hero}>
          <div className={styles.galleryCol}>
            <ProductGallery images={productImages} title={activeProduct.title} />
          </div>
          {/* Mobile-only price under gallery */}
          <p className={styles.mobilePriceRow}>{formatPrice(activeProduct.price)}</p>
          <div className={styles.infoCol}>
            <ProductDetails
              product={activeProduct}
              baseProductId={product?.id ?? activeProduct.id}
              variantProducts={variantProducts}
              activeVariantId={activeVariantId}
              onVariantChange={setActiveVariantId}
              reviewsCount={reviewsCount}
              specs={specs}
              specsExpanded={specsExpanded}
              onSpecsExpandedChange={setSpecsExpanded}
            />
          </div>
          <div className={styles.buyCol}>
            <ProductPurchasePanel product={activeProduct} />
          </div>
        </div>

        <div className={styles.sections}>
          <div className={styles.description}>
            <h2>Описание</h2>
            <p>{activeProduct.descriptionFull ?? activeProduct.description}</p>
          </div>
        </div>

        <ProductReviewsPreview productId={activeProduct.id} product={activeProduct} reviews={reviews} summary={summary} />

        <ProductFeed productId={activeProduct.id} />
      </div>
    </section>
  );
};
