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

  return (
    <aside className={styles.purchasePanel}>
      <div className={styles.buyBoxCard}>
        <p className={styles.buyPrice}>{formatPrice(product.price)}</p>

        <div className={styles.buyButtons}>
          <Button onClick={() => addItem(product, 1)}>
            В корзину
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              startBuyNow(product, 1);
              navigate('/checkout');
            }}
          >
            Купить сейчас
          </Button>
        </div>

        <p className={styles.trustRow}>Защита покупателя · Возврат 14 дней</p>

        <div className={styles.deliveryCard}>
          <h3>Доставка</h3>
          <p>Курьером — уточняется при оформлении</p>
          <p>Самовывоз из ПВЗ — бесплатно</p>
        </div>
      </div>
    </aside>
  );
};
