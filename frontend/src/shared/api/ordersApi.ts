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
  paidAt?: string | null;
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
  cdekOrderId?: string | null;
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
    case 'PAID':
    case 'READY_FOR_SHIPMENT':
    case 'PRINTING':
    case 'HANDED_TO_DELIVERY':
    case 'IN_TRANSIT':
    case 'DELIVERED':
    case 'CANCELLED':
    case 'RETURNED':
    case 'EXPIRED':
      return status;
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
  paidAt: order.paidAt ?? null,
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
  cdekOrderId: order.cdekOrderId ?? null,
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
    deliveryMethod?: 'courier' | 'cdek_pvz';
    cdekPvzCode?: string;
    cdekPvzAddress?: string;
    cdekPvzCityCode?: number;
    cdekPvzRaw?: {
      city_code: number;
      city?: string;
      address_full?: string;
      latitude?: number;
      longitude?: number;
      work_time?: string;
    };
  }) => {
    const result = await api.createOrder({
      contactId: payload.contactId,
      shippingAddressId: payload.shippingAddressId,
      deliveryMethod: payload.deliveryMethod,
      cdekPvzCode: payload.cdekPvzCode,
      cdekPvzAddress: payload.cdekPvzAddress,
      cdekPvzCityCode: payload.cdekPvzCityCode,
      cdekPvzRaw: payload.cdekPvzRaw,
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
  syncShipment: async (shipmentId: string) => {
    return api.syncShipment(shipmentId);
  },
  syncCdekOrder: async (orderId: string) => {
    return api.syncCdekOrder(orderId);
  },
  cancelMyOrder: async (orderId: string) => {
    const result = await api.cancelMyOrder(orderId);
    return mapOrder(result.data as unknown as ApiOrder);
  },
  downloadShippingLabel: async (shipmentId: string) => {
    return api.downloadShippingLabel(shipmentId);
  },
  downloadShipmentBarcodes: async (shipmentId: string) => {
    return api.downloadShipmentBarcodes(shipmentId);
  },
  downloadShipmentAct: async (shipmentId: string) => {
    return api.downloadShipmentAct(shipmentId);
  },
  downloadSellerDocument: async (orderId: string, type: 'packing-slip' | 'labels' | 'handover-act') => {
    return api.downloadSellerOrderDocument(orderId, type);
  }
};
