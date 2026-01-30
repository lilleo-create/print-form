import { Order, OrderItem, OrderStatus } from '../types';
import { api } from './index';

const mapStatus = (status?: string): OrderStatus => {
  switch (status) {
    case 'PRINTING':
      return 'printing';
    case 'SHIPPED':
      return 'shipped';
    case 'DELIVERED':
      return 'delivered';
    default:
      return 'processing';
  }
};

const mapOrder = (order: any): Order => ({
  id: order.id,
  buyerId: order.buyerId,
  buyerEmail: order.buyer?.email ?? '',
  contactId: order.contactId ?? '',
  shippingAddressId: order.shippingAddressId ?? '',
  status: mapStatus(order.status),
  total: order.total,
  createdAt: order.createdAt,
  items: (order.items ?? []).map((item: any) => ({
    productId: item.productId,
    title: item.product?.title ?? '',
    price: item.priceAtPurchase,
    qty: item.quantity,
    sellerId: item.product?.sellerId ?? '',
    lineTotal: item.priceAtPurchase * item.quantity,
    image: item.product?.image,
    status: 'new'
  }))
});

export const ordersApi = {
  listByBuyer: async (buyerId: string) => {
    const result = await api.getOrders();
    return (result.data ?? []).map(mapOrder).filter((order) => order.buyerId === buyerId);
  },
  listBySeller: async (sellerId: string) => {
    const result = await api.getSellerOrders();
    return (result.data ?? []).map(mapOrder).filter((order) =>
      order.items.some((item) => item.sellerId === sellerId)
    );
  },
  create: async (payload: {
    buyerId: string;
    buyerEmail: string;
    contactId: string;
    shippingAddressId: string;
    items: OrderItem[];
    total: number;
  }) => {
    const result = await api.createOrder({
      contactId: payload.contactId,
      shippingAddressId: payload.shippingAddressId,
      items: payload.items.map((item) => ({
        productId: item.productId,
        quantity: item.qty
      }))
    });
    return mapOrder(result.data);
  }
};
