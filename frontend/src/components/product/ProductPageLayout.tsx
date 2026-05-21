import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useFavoritesStore } from '../../features/favorites/model/useFavoritesStore';
import { ShareModal } from '../../features/share/ui/ShareModal';
import { useCartStore } from '../../app/store/cartStore';
import { Button } from '../../shared/ui/Button';

type ProductPageLayoutProps = {
  productId: string;
};

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
  </svg>
);

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);

export const ProductPageLayout = ({ productId }: ProductPageLayoutProps) => {
  const navigate = useNavigate();
  const { data: product, status, error } = useProduct(productId, { keepPreviousData: false });
  const [variantProducts, setVariantProducts] = useState<Product[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string>(productId);
  const [specsExpanded, setSpecsExpanded] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [stickyBarVisible, setStickyBarVisible] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const purchaseSentinelRef = useRef<HTMLDivElement>(null);

  const isFavorite = useFavoritesStore((state) => state.isFavorite(product?.id ?? ''));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const fetchFavorites = useFavoritesStore((state) => state.fetchFavorites);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    document.body.classList.add('hide-bottom-nav');
    return () => document.body.classList.remove('hide-bottom-nav');
  }, []);

  useEffect(() => {
    setActiveVariantId(productId);
  }, [productId]);

  useEffect(() => {
    if (product?.id) void fetchFavorites();
  }, [fetchFavorites, product?.id]);

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
    return () => { isMounted = false; };
  }, [product]);

  const activeProduct = useMemo(() => {
    if (!product) return null;
    if (!variantProducts.length) return product;
    return variantProducts.find((item) => item.id === activeVariantId) ?? product;
  }, [activeVariantId, product, variantProducts]);

  useEffect(() => {
    setSpecsExpanded(false);
    setAboutExpanded(false);
  }, [activeProduct?.id]);

  // Sticky top bar — appears when purchase panel scrolls out of view
  useEffect(() => {
    const el = purchaseSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyBarVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeProduct?.id]);

  const { reviews, summary } = useProductReviews(activeProduct?.id ?? productId, { keepPreviousData: false });

  useProductBoard(activeProduct);

  const specs = useMemo<SpecItem[]>(() => normalizeProductSpecs(activeProduct), [activeProduct]);

  const seoTitle = activeProduct ? `${activeProduct.title} — купить на PrintForm` : 'Товар — PrintForm';
  const seoDescription = activeProduct
    ? `${activeProduct.descriptionShort || activeProduct.description || ''}`.slice(0, 160)
    : 'Товар из каталога PrintForm.';
  const canonicalUrl = activeProduct
    ? `https://print-form.ru/product/${activeProduct.id}`
    : `https://print-form.ru/product/${productId}`;

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
  const descriptionText = activeProduct.descriptionFull ?? activeProduct.description ?? '';
  const visibleSpecs = specsExpanded ? specs : specs.slice(0, 8);

  const handleFavoriteClick = () => {
    void toggleFavorite(activeProduct.id, {
      id: activeProduct.id,
      title: activeProduct.title,
      price: activeProduct.price,
      image: activeProduct.image,
      ratingAvg: activeProduct.ratingAvg,
      ratingCount: activeProduct.ratingCount,
      shortSpec: activeProduct.descriptionShort,
      category: activeProduct.category,
    });
  };

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

      {/* Sticky top bar */}
      <div className={`${styles.stickyBar} ${stickyBarVisible ? styles.stickyBarVisible : ''}`}>
        <div className={styles.stickyBarInner}>
          <div className={styles.stickyBarInfo}>
            <span className={styles.stickyBarTitle}>{activeProduct.title}</span>
          </div>
          <span className={styles.stickyBarPrice}>{formatPrice(activeProduct.price)}</span>
          <Button size="sm" onClick={() => addItem(activeProduct, 1)}>В корзину</Button>
        </div>
      </div>

      <div className={styles.container}>
        {/* Mobile back button */}
        <div className={styles.mobileTopBar}>
          <button type="button" className={styles.mobileBackBtn} onClick={() => navigate(-1)} aria-label="Назад">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        <div className={styles.pageLayout}>
          {/* ── LEFT MAIN COLUMN ── */}
          <div className={styles.mainCol}>

            {/* Breadcrumb above gallery */}
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

            {/* Hero: gallery + product info */}
            <div className={styles.heroRow}>
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
            </div>

            {/* Mobile price */}
            <p className={styles.mobilePriceRow}>{formatPrice(activeProduct.price)}</p>

            {/* ── SECTIONS BELOW ── */}
            <div className={styles.contentSections}>

              {/* О товаре */}
              {descriptionText && (
                <div className={styles.sectionRow}>
                  <h2 className={styles.sectionLabel}>О товаре</h2>
                  <div className={styles.sectionContent}>
                    <div className={`${styles.aboutBody} ${aboutExpanded ? '' : styles.aboutBodyClamped}`}>
                      {descriptionText.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={styles.showMoreBtn}
                      onClick={() => setAboutExpanded((v) => !v)}
                    >
                      {aboutExpanded ? 'Скрыть ›' : 'Показать полностью ›'}
                    </button>
                  </div>
                </div>
              )}

              {/* Характеристики */}
              {specs.length > 0 && (
                <div className={styles.sectionRow}>
                  <h2 className={styles.sectionLabel}>Характеристики</h2>
                  <div className={styles.sectionContent}>
                    <ul className={styles.specsList}>
                      {visibleSpecs.map((s, i) => (
                        <li key={`${s.name}-${i}`} className={styles.specRow}>
                          <span className={styles.specName}>{s.name}</span>
                          <span className={styles.specValue}>{s.value}</span>
                        </li>
                      ))}
                    </ul>
                    {specs.length > 8 && (
                      <button
                        type="button"
                        className={styles.allSpecsSectionBtn}
                        onClick={() => setSpecsExpanded((v) => !v)}
                      >
                        {specsExpanded ? 'Скрыть' : 'Все характеристики ›'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Отзывы */}
              <div className={styles.sectionRow}>
                <h2 className={styles.sectionLabel}>Отзывы</h2>
                <div className={styles.sectionContent}>
                  <ProductReviewsPreview
                    productId={activeProduct.id}
                    product={activeProduct}
                    reviews={reviews}
                    summary={summary}
                  />
                </div>
              </div>

            </div>

            <ProductFeed productId={activeProduct.id} />
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className={styles.sidebar}>
            {/* Favorites + Share */}
            <div className={styles.sidebarActions}>
              <button
                type="button"
                className={`${styles.actionBtn} ${isFavorite ? styles.actionBtnFav : ''}`}
                onClick={handleFavoriteClick}
              >
                <HeartIcon filled={isFavorite} />
                {isFavorite ? 'В избранном' : 'В избранное'}
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setIsShareOpen(true)}
              >
                <ShareIcon />
                Поделиться
              </button>
            </div>

            {/* Purchase panel — ref for sticky bar detection */}
            <div ref={purchaseSentinelRef}>
              <ProductPurchasePanel product={activeProduct} />
            </div>

            {/* Ad block */}
            <div className={styles.adBlock}>
              <span>Реклама</span>
            </div>
          </div>
        </div>
      </div>

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={activeProduct.title}
        image={activeProduct.image}
      />
    </section>
  );
};
