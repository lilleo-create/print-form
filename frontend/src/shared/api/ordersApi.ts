import { Order, OrderItem, OrderStatus } from '../types';
import { api } from './index';

const mapStatus = (status?: string): OrderStatus => {
  switch (status) {
    case 'CREATED':
      return 'CREATED';
    case 'PRINTING':
      return 'PRINTING';
    case 'HANDED_TO_DELIVERY':
      return 'HANDED_TO_DELIVERY';
    case 'IN_TRANSIT':
      return 'IN_TRANSIT';
    case 'DELIVERED':
      return 'DELIVERED';
    default:
      return 'CREATED';
  }
};

const mapOrder = (order: any): Order => ({
  id: order.id,
  buyerId: order.buyerId,
  buyerEmail: order.buyer?.email ?? '',
  contactId: order.contactId ?? '',
  shippingAddressId: order.shippingAddressId ?? '',
  status: mapStatus(order.status),
  statusUpdatedAt: order.statusUpdatedAt,
  total: order.total,
  createdAt: order.createdAt,
  trackingNumber: order.trackingNumber ?? null,
  carrier: order.carrier ?? null,
  contact: order.contact ?? null,
  shippingAddress: order.shippingAddress ?? null,
  buyer: order.buyer ?? null,
  items: (order.items ?? []).map((item: any) => ({
    id: item.id,
    productId: item.productId,
    title: item.product?.title ?? '',
    price: item.priceAtPurchase,
    qty: item.quantity,
    sellerId: item.product?.sellerId ?? '',
    lineTotal: item.priceAtPurchase * item.quantity,
    image: item.product?.image
  }))
});

export const ordersApi = {
  listByBuyer: async (buyerId: string) => {
    const result = await api.getOrders();
    return (result.data ?? []).map(mapOrder).filter((order) => order.buyerId === buyerId);
  },
  listBySeller: async (sellerId: string, status?: OrderStatus) => {
    const result = await api.getSellerOrders(status ? { status } : undefined);
    return (result.data ?? [])
      .map(mapOrder)
      .filter((order) => order.items.some((item) => item.sellerId === sellerId));
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
