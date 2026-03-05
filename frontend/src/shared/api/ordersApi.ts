import { Order, OrderItem, OrderStatus } from '../types';
import { api } from './index';
import { DeliveryStage } from '../lib/deliveryStatus';

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
  readyForShipmentAt?: string | null;
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
  deliveryDaysMin?: number | null;
  deliveryDaysMax?: number | null;
  deliveryTariffCode?: number | null;
  deliveryCalculatedAt?: string | null;
  deliveryEtaText?: string | null;
  estimatedDeliveryDateMin?: string | null;
  estimatedDeliveryDateMax?: string | null;
  isPacked?: boolean;
  isLabelPrinted?: boolean;
  isActPrinted?: boolean;
  fulfillmentUpdatedAt?: string | null;
  items?: ApiOrderItem[];
};

const mapStatus = (status?: string): OrderStatus => {
  switch (status) {
    case 'CREATED':
      return 'CREATED';
    case 'PAID':
      return 'PAID';
    case 'READY_FOR_SHIPMENT':
      return 'READY_FOR_SHIPMENT';
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
  readyForShipmentAt: order.readyForShipmentAt ?? null,
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
  deliveryDaysMin: order.deliveryDaysMin ?? null,
  deliveryDaysMax: order.deliveryDaysMax ?? null,
  deliveryTariffCode: order.deliveryTariffCode ?? null,
  deliveryCalculatedAt: order.deliveryCalculatedAt ?? null,
  deliveryEtaText: order.deliveryEtaText ?? null,
  estimatedDeliveryDateMin: order.estimatedDeliveryDateMin ?? null,
  estimatedDeliveryDateMax: order.estimatedDeliveryDateMax ?? null,
  isPacked: order.isPacked ?? false,
  isLabelPrinted: order.isLabelPrinted ?? false,
  isActPrinted: order.isActPrinted ?? false,
  fulfillmentUpdatedAt: order.fulfillmentUpdatedAt ?? null,
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
  downloadShipmentLabel: async (shipmentId: string) => {
    return api.downloadShipmentLabel(shipmentId);
  },
  downloadShipmentAct: async (shipmentId: string) => {
    return api.downloadShipmentAct(shipmentId);
  },
  downloadSellerDocument: async (orderId: string, type: 'packing-slip' | 'labels' | 'handover-act') => {
    return api.downloadSellerOrderDocument(orderId, type);
  },
  updateSellerShipmentStage: async (orderId: string, stage: DeliveryStage) => {
    return api.updateSellerShipmentStage(orderId, { stage });
  },
  updateSellerFulfillmentSteps: async (orderId: string, payload: { isPacked?: boolean; isLabelPrinted?: boolean; isActPrinted?: boolean }) => {
    return api.updateSellerFulfillmentSteps(orderId, payload);
  },
  cancelOrder: async (orderId: string, payload?: { reason?: string; comment?: string }) => {
    return api.cancelOrder(orderId, payload);
  }
};
