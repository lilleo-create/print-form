import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
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

type ProductPageLayoutProps = {
  productId: string;
};

export const ProductPageLayout = ({ productId }: ProductPageLayoutProps) => {
  const { data: product, status, error } = useProduct(productId, { keepPreviousData: false });
  const [variantProducts, setVariantProducts] = useState<Product[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string>(productId);
  const [specsExpanded, setSpecsExpanded] = useState(false);

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
        <div className={styles.container}>
          <p>Загрузка...</p>
        </div>
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
        <div className={styles.hero}>
          <div className={styles.galleryCol}>
            <ProductGallery images={productImages} title={activeProduct.title} />
          </div>
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
