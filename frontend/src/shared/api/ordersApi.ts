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
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  packagesCount?: number;
  buyerPickupPvzMeta?: { addressFull?: string } | null;
  sellerDropoffPvzMeta?: { addressFull?: string } | null;
  orderLabels?: Array<{ packageNo: number; code: string }>;
  createdAt: string;
  payoutStatus?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  contact?: Order['contact'];
  shippingAddress?: Order['shippingAddress'];
  delivery?: Order['delivery'] | null;
  shipment?: Order['shipment'] | null;
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
  recipientName: order.recipientName ?? null,
  recipientPhone: order.recipientPhone ?? null,
  recipientEmail: order.recipientEmail ?? null,
  packagesCount: order.packagesCount ?? 1,
  buyerPickupPvzMeta: order.buyerPickupPvzMeta ?? null,
  sellerDropoffPvzMeta: order.sellerDropoffPvzMeta ?? null,
  orderLabels: order.orderLabels ?? [],
  createdAt: order.createdAt,
  payoutStatus: order.payoutStatus ?? null,
  trackingNumber: order.trackingNumber ?? null,
  carrier: order.carrier ?? null,
  contact: order.contact ?? null,
  shippingAddress: order.shippingAddress ?? null,
  buyer: order.buyer ?? null,
  delivery: order.delivery ?? null,
  shipment: order.shipment ?? null,
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
  },
  readyToShip: async (orderId: string) => {
    const result = await api.readyToShip(orderId);
    return result.data;
  },
  downloadShippingLabel: async (orderId: string) => {
    return api.downloadShippingLabel(orderId);
  },
  downloadYandexHandoverAct: async (payload: {
    mode?: 'new_requests' | 'by_request_ids' | 'by_date_range';
    request_ids?: string[];
    editable_format?: boolean;
    created_since?: number;
    created_until?: number;
    created_since_utc?: string;
    created_until_utc?: string;
  }) => {
    return api.downloadYandexHandoverAct(payload);
  },
  downloadSellerDocument: async (orderId: string, type: 'packing-slip' | 'labels' | 'handover-act') => {
    return api.downloadSellerOrderDocument(orderId, type);
  }
};
