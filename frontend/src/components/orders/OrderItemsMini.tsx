import type { Order } from '../../shared/types';
import { ProductMiniCard } from '../ProductMiniCard';

interface OrderItemsMiniProps {
  order: Order;
}

export const OrderItemsMini = ({ order }: OrderItemsMiniProps) => {
  const firstItem = order.items[0];
  if (!firstItem) {
    return null;
  }

  return <ProductMiniCard title={firstItem.title} price={firstItem.price} qty={firstItem.qty} image={firstItem.image} />;
};
