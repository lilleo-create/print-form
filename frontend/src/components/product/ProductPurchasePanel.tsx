import { useNavigate } from 'react-router-dom';
import type { Product } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { useBuyNowStore } from '../../app/store/buyNowStore';
import { useCartStore } from '../../app/store/cartStore';
import { formatPrice } from '../../utils/money';
import { formatReadyToShipLabel } from '../../shared/lib/dateLabels';
import styles from '../../pages/ProductPage.module.css';

type ProductPurchasePanelProps = {
  product: Product;
};

export const ProductPurchasePanel = ({ product }: ProductPurchasePanelProps) => {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const startBuyNow = useBuyNowStore((state) => state.start);

  const readyToShipLabel = formatReadyToShipLabel(product.productionTimeHours);

  return (
    <aside className={styles.purchasePanel}>
      <p className={styles.buyPrice}>{formatPrice(product.price)}</p>

      <div className={styles.installmentBlock}>
        <strong>12×{Math.max(1, Math.round(product.price / 12))}₽</strong>
        <span>12 месяцев, без переплат</span>
      </div>

      <div className={styles.buyButtons}>
        <Button
          onClick={() => addItem(product, 1)}
        >
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

      <div className={styles.deliveryCard}>
        <h3>Доставка</h3>
        <p>Готово к отправке: {readyToShipLabel}</p>
        <p>Курьером: 149 ₽</p>
        <p>Самовывоз: 0 ₽</p>
      </div>
    </aside>
  );
};
