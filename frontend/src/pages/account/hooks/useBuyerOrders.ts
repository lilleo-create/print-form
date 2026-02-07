import { useEffect, useMemo } from 'react';
import { useOrdersStore } from '../../../app/store/ordersStore';
import { User } from '../../../shared/types';

export const useBuyerOrders = (user: User | null) => {
  const orders = useOrdersStore((state) => state.orders);
  const loadBuyerOrders = useOrdersStore((state) => state.loadBuyerOrders);

  useEffect(() => {
    if (user) {
      loadBuyerOrders(user);
    }
  }, [loadBuyerOrders, user]);

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status !== 'DELIVERED'),
    [orders]
  );
  const deliveredOrders = useMemo(
    () => orders.filter((order) => order.status === 'DELIVERED'),
    [orders]
  );

  const purchasedItems = useMemo(
    () =>
      deliveredOrders.flatMap((order) =>
        (order.items ?? []).map((item) => ({
          productId: item.productId,
          title: item.title,
          price: item.price,
          image: item.image,
          orderDate: order.statusUpdatedAt ?? order.createdAt,
          orderId: order.id
        }))
      ),
    [deliveredOrders]
  );

  const returnCandidates = useMemo(
    () =>
      deliveredOrders.flatMap((order) =>
        (order.items ?? [])
          .filter((item) => item.id)
          .map((item) => ({
            orderItemId: item.id as string,
            productId: item.productId,
            title: item.title,
            price: item.price,
            image: item.image,
            orderDate: order.statusUpdatedAt ?? order.createdAt,
            orderId: order.id
          }))
      ),
    [deliveredOrders]
  );

  return { activeOrders, purchasedItems, returnCandidates };
};
