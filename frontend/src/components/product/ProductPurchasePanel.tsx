import { useNavigate } from 'react-router-dom';
import type { Product } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { useBuyNowStore } from '../../app/store/buyNowStore';
import { useCartStore } from '../../app/store/cartStore';
import { formatPrice } from '../../utils/money';
import styles from '../../pages/ProductPage.module.css';

type ProductPurchasePanelProps = {
  product: Product;
};

export const ProductPurchasePanel = ({ product }: ProductPurchasePanelProps) => {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const startBuyNow = useBuyNowStore((state) => state.start);

  const handleBuyNow = () => {
    startBuyNow(product, 1);
    navigate('/checkout');
  };

  return (
    <>
      {/* Desktop: sticky card */}
      <aside className={styles.purchasePanel}>
        <div className={styles.buyBoxCard}>
          <p className={styles.buyPrice}>{formatPrice(product.price)}</p>

          <div className={styles.buyButtons}>
            <Button onClick={() => addItem(product, 1)}>В корзину</Button>
            <Button variant="secondary" onClick={handleBuyNow}>Купить сейчас</Button>
          </div>

          <p className={styles.trustRow}>Защита покупателя · Возврат 14 дней</p>
        </div>
      </aside>

      {/* Mobile: fixed bottom bar (glass effect, no price) */}
      <div className={styles.mobileBuyBar}>
        <Button variant="secondary" onClick={handleBuyNow}>Купить сейчас</Button>
        <Button onClick={() => addItem(product, 1)}>В корзину</Button>
      </div>
    </>
  );
};
