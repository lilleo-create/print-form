import { PurchasedItemsList } from '../../../../components/returns/PurchasedItemsList';
import styles from './PurchasesTab.module.css';

interface PurchasedItem {
  productId: string;
  title: string;
  price: number;
  image?: string | null;
  orderDate: string;
  orderId: string;
}

interface PurchasesTabProps {
  items: PurchasedItem[];
}

export const PurchasesTab = ({ items }: PurchasesTabProps) => {
  return (
    <div className={styles.section}>
      <PurchasedItemsList items={items} />
    </div>
  );
};
