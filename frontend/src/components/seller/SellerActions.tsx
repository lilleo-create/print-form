import { Button } from '../../shared/ui/Button';
import styles from '../../pages/SellerAccountPage.module.css';

type SellerActionsProps = {
  canSell: boolean;
  onAddProduct: () => void;
};

export const SellerActions = ({ canSell, onAddProduct }: SellerActionsProps) => {
  return (
    <div className={styles.sectionActions}>
      <Button
        type="button"
        onClick={() => {
          if (!canSell) {
            return;
          }
          onAddProduct();
        }}
        disabled={!canSell}
      >
        Добавить товар
      </Button>
      {!canSell && <span className={styles.helperText}>Добавление и редактирование товаров станут доступны после подтверждения профиля продавца.</span>}
    </div>
  );
};
