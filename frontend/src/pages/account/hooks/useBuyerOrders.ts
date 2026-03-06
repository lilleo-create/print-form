import { useEffect, useMemo } from 'react';
import { useOrdersStore } from '../../../app/store/ordersStore';
import { User } from '../../../shared/types';

const isShipmentSent = (order: {
  status?: string;
  shipment?: { status?: string } | null;
}) => {
  const orderStatus = String(order.status ?? '').toUpperCase();
  const shipmentStatus = String(order.shipment?.status ?? '').toUpperCase();
  return (
    ['HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'].includes(orderStatus) ||
    ['IN_TRANSIT', 'DELIVERED', 'RETURNED'].includes(shipmentStatus)
  );
};

export const useBuyerOrders = (user: User | null) => {
  const orders = useOrdersStore((state) => state.orders);
  const loadBuyerOrders = useOrdersStore((state) => state.loadBuyerOrders);

  useEffect(() => {
    if (user) {
      loadBuyerOrders(user);
    }
  }, [loadBuyerOrders, user]);

  const activeOrders = useMemo(
    () => orders.filter((order) => !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(order.status)),
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
      orders
        .filter((order) => !['CANCELLED', 'RETURNED', 'EXPIRED'].includes(order.status))
        .flatMap((order) =>
          (order.items ?? [])
            .filter((item) => item.id)
            .map((item) => ({
              orderItemId: item.id as string,
              productId: item.productId,
              title: item.title,
              price: item.price,
              image: item.image,
              orderDate: order.statusUpdatedAt ?? order.createdAt,
              orderId: order.id,
              actionType: isShipmentSent(order) ? ('RETURN' as const) : ('CANCEL' as const)
            }))
        ),
    [orders]
  );

  return { activeOrders, purchasedItems, returnCandidates };
};
