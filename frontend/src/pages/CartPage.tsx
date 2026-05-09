import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore, STALE_CART_MS } from '../app/store/cartStore';
import { useAuthStore } from '../app/store/authStore';
import { useBuyNowStore } from '../app/store/buyNowStore';
import { useCartRecommendations } from '../hooks/useCartRecommendations';
import { ProductCard } from '../widgets/shop/ProductCard';
import { Skeleton } from '../shared/ui/Skeleton';
import styles from './CartPage.module.css';
import { getProductMainImage } from '../shared/lib/productMedia';
import { SmartImage } from '../shared/ui/SmartImage';
import { formatPrice } from '../utils/money';

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const HeartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
  </svg>
);

const ShareIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

export const CartPage = () => {
  const allItems = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const user = useAuthStore((state) => state.user);
  const clearBuyNow = useBuyNowStore((state) => state.clear);
  const navigate = useNavigate();

  const now = Date.now();

  const { freshItems, staleItems } = useMemo(() => {
    const fresh = allItems.filter((i) => !i.addedAt || now - i.addedAt < STALE_CART_MS);
    const stale = allItems.filter((i) => i.addedAt && now - i.addedAt >= STALE_CART_MS);
    return { freshItems: fresh, staleItems: stale };
  }, [allItems, now]);

  const displayItems = freshItems.length > 0 ? freshItems : allItems;
  const teaserItems = freshItems.length > 0 ? staleItems : [];

  // ── Selection state ──
  const allIds = useMemo(() => displayItems.map((i) => i.product.id), [displayItems]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(allIds));

  const allSelected = selectedIds.size === allIds.length && allIds.length > 0;
  const anySelected = selectedIds.size > 0;

  const toggleAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  }, [allSelected, allIds]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Share ──
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    const ids = [...selectedIds].join(',');
    if (!ids) return;
    const url = `${window.location.origin}/cart/shared?items=${ids}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [selectedIds]);

  // ── Delete selected ──
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === allIds.length) {
      clearCart();
    } else {
      selectedIds.forEach((id) => removeItem(id));
    }
    setSelectedIds(new Set());
  }, [selectedIds, allIds.length, clearCart, removeItem]);

  const subtotal = useMemo(
    () => allItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [allItems]
  );

  const { items: recItems, isLoading: recLoading } = useCartRecommendations();

  const handleCheckout = () => {
    clearBuyNow();
    if (!user) {
      navigate('/auth/login?redirectTo=/checkout');
      return;
    }
    navigate('/checkout');
  };

  if (allItems.length === 0) {
    return (
      <section className={styles.page}>
        <div className={`container ${styles.container}`}>
          <h1 className={styles.title}>Корзина</h1>
          <div className={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.emptyIcon}>
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            <p>Корзина пуста</p>
            <Link to="/catalog" className={styles.emptyLink}>Перейти в каталог</Link>
          </div>
          <section className={styles.recSection}>
            <h2 className={styles.recTitle}>Может пригодиться</h2>
            <div className={styles.recGrid}>
              {recItems.map((product) => <ProductCard key={product.id} product={product} />)}
              {recLoading && Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className={styles.recSkeleton} />)}
            </div>
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      {/* ── Mobile sticky CTA bar ── */}
      <div className={styles.mobileCta}>
        <div className={styles.mobileCtaTotal}>
          <strong>{formatPrice(subtotal)}</strong>
        </div>
        <button type="button" className={styles.mobileCtaBtn} onClick={handleCheckout}>
          К оформлению
        </button>
      </div>

      <div className={`container ${styles.container}`}>
        <h1 className={styles.title}>Корзина</h1>

        <div className={styles.content}>
          {/* ── Left column ── */}
          <div className={styles.left}>

            {/* ── Toolbar ── */}
            <div className={styles.toolbar}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={allSelected}
                  onChange={toggleAll}
                />
                <span className={`${styles.checkbox} ${anySelected ? styles.checkboxChecked : ''}`}>
                  {anySelected && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className={styles.toolbarCount}>
                  {selectedIds.size} товар{selectedIds.size !== 1 ? 'а' : ''}
                </span>
              </label>

              <div className={styles.toolbarActions}>
                <button
                  type="button"
                  className={styles.toolbarBtn}
                  onClick={handleShare}
                  disabled={selectedIds.size === 0}
                  title="Поделиться"
                >
                  <ShareIcon />
                  <span>{copied ? 'Скопировано!' : 'Поделиться'}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.toolbarBtn} ${styles.toolbarBtnDanger}`}
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0}
                  title="Удалить выбранные"
                >
                  <TrashIcon />
                  <span>Удалить</span>
                </button>
              </div>
            </div>

            {/* ── Items ── */}
            <div className={styles.list}>
              {displayItems.map((item) => {
                const imageSrc = getProductMainImage(item.product);
                const isSelected = selectedIds.has(item.product.id);
                return (
                  <article
                    key={item.product.id}
                    className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                  >
                    <div className={styles.imageWrap}>
                      {imageSrc
                        ? <SmartImage src={imageSrc} alt={item.product.title} sizePreset="card" />
                        : <div className={styles.imageFallback} aria-hidden="true" />
                      }
                      <label className={styles.itemCheckbox}>
                        <input
                          type="checkbox"
                          className={styles.checkboxInput}
                          checked={isSelected}
                          onChange={() => toggleOne(item.product.id)}
                        />
                        <span className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                      </label>
                    </div>

                    <div className={styles.info}>
                      <h3 className={styles.itemTitle}>{item.product.title}</h3>
                      {item.product.stock != null && (
                        <p className={styles.stock}>В наличии: {item.product.stock} шт</p>
                      )}
                      <p className={styles.price}>{formatPrice(item.product.price)}</p>
                    </div>

                    <div className={styles.controls}>
                      <div className={styles.iconRow}>
                        <button type="button" className={styles.iconBtn} aria-label="В избранное"><HeartIcon /></button>
                        <button type="button" className={styles.iconBtn} aria-label="Удалить" onClick={() => removeItem(item.product.id)}><TrashIcon /></button>
                      </div>
                      <div className={styles.qty}>
                        <button type="button" className={styles.qtyBtn} onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))} aria-label="Уменьшить">−</button>
                        <span className={styles.qtyVal}>{item.quantity}</span>
                        <button type="button" className={styles.qtyBtn} onClick={() => updateQuantity(item.product.id, item.quantity + 1)} aria-label="Увеличить">+</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* ── Stale teaser ── */}
            {teaserItems.length > 0 && (
              <Link to="/cart/saved" className={styles.savedTeaser}>
                <div className={styles.savedTeaserImages}>
                  {teaserItems.slice(0, 3).map((item) => {
                    const src = getProductMainImage(item.product);
                    return src
                      ? <img key={item.product.id} src={src} alt={item.product.title} className={styles.savedTeaserImg} />
                      : <div key={item.product.id} className={styles.savedTeaserImgFallback} />;
                  })}
                </div>
                <span className={styles.savedTeaserText}>
                  <strong>Ещё {teaserItems.length} товар{teaserItems.length !== 1 ? 'а' : ''}</strong>
                  <span>Давно в корзине</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </Link>
            )}

          </div>

          {/* ── Summary ── */}
          <aside className={styles.summary}>
            <button type="button" className={styles.cta} onClick={handleCheckout}>
              Перейти к оформлению
            </button>
            <div className={styles.promoWrap}>
              <input type="text" className={styles.promoInput} placeholder="Промокод" />
            </div>
            <div className={styles.totals}>
              <div className={styles.totalsRow}>
                <span>{allItems.length} товар{allItems.length !== 1 ? 'а' : ''}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className={styles.totalsRow}>
                <span>Выгода</span>
                <span className={styles.saving}>−0 ₽</span>
              </div>
              <div className={styles.totalsRow}>
                <span>Доставка и сервисы</span>
                <span className={styles.muted}>при оформлении</span>
              </div>
              <div className={styles.totalsDivider} />
              <div className={styles.totalsTotal}>
                <span>Итого</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
            </div>
          </aside>
        </div>

        {/* ── Recommendations — separate block, width = left column ── */}
        <section className={styles.recSection}>
          <h2 className={styles.recTitle}>Может пригодиться</h2>
          <div className={styles.recGrid}>
            {recItems.map((product) => <ProductCard key={product.id} product={product} />)}
            {recLoading && Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className={styles.recSkeleton} />)}
          </div>
        </section>
      </div>
    </section>
  );
};
