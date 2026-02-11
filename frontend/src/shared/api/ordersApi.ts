import { Order, OrderItem, OrderStatus } from '../types';
import { api } from './index';

type ApiOrderItem = {
  id: string;
  productId: string;
  priceAtPurchase: number;
  quantity: number;
  product?: {
    title?: string;
    sellerId?: string;
    image?: string;
  };
};

type ApiOrder = {
  id: string;
  buyerId: string;
  buyer?: { id: string; name: string; email: string; phone?: string | null };
  contactId?: string | null;
  shippingAddressId?: string | null;
  status?: string;
  statusUpdatedAt?: string;
  total: number;
  createdAt: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  contact?: Order['contact'];
  shippingAddress?: Order['shippingAddress'];
  delivery?: Order['delivery'] | null;
  items?: ApiOrderItem[];
};

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

const mapOrder = (order: ApiOrder): Order => ({
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
  delivery: order.delivery ?? null,
  items: (order.items ?? []).map((item) => ({
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
    const raw = result.data as unknown as ApiOrder[];
    return (raw ?? []).map(mapOrder).filter((order) => order.buyerId === buyerId);
  },
  listBySeller: async (sellerId: string, status?: OrderStatus) => {
    const result = await api.getSellerOrders(status ? { status } : undefined);
    const raw = result.data as unknown as ApiOrder[];
    return (raw ?? [])
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
    return mapOrder(result.data as unknown as ApiOrder);
  }
};
