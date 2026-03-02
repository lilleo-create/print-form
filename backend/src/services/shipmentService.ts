import { prisma } from '../lib/prisma';
import { cdekService } from './cdekService';

export type ShipmentInternalStatus =
  | 'CREATED'
  | 'VALIDATING'
  | 'READY_TO_SHIP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

const FINAL_STATUSES: ShipmentInternalStatus[] = ['DELIVERED', 'CANCELLED', 'FAILED'];

export const mapYandexStatusToInternal = (status?: string | null): ShipmentInternalStatus => {
  const normalized = (status ?? '').toUpperCase();
  if (['DELIVERY_DELIVERED', 'DELIVERED'].includes(normalized)) return 'DELIVERED';
  if (['CANCELLED', 'DELIVERY_CANCELLED'].includes(normalized)) return 'CANCELLED';
  if (['DRAFT', 'VALIDATING'].includes(normalized)) return 'VALIDATING';
  if (['CREATED', 'ACCEPTED', 'READY_FOR_PICKUP', 'READY_TO_SHIP'].includes(normalized)) return 'READY_TO_SHIP';
  if (
    ['DELIVERY_ARRIVED_PICKUP_POINT', 'DELIVERY_TRANSPORTATION', 'IN_TRANSIT', 'DELIVERY_TRANSMITTED_TO_RECIPIENT'].includes(
      normalized
    )
  ) {
    return 'IN_TRANSIT';
  }
  return 'CREATED';
};

type ShipmentRow = {
  id: string;
  order_id: string;
  provider: string;
  delivery_method: 'COURIER' | 'PICKUP_POINT';
  source_station_id: string;
  source_station_snapshot: Record<string, unknown> | null;
  destination_station_id: string;
  destination_station_snapshot: Record<string, unknown> | null;
  offer_payload: string | null;
  request_id: string | null;
  status: ShipmentInternalStatus;
  status_raw: Record<string, unknown> | null;
  last_sync_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const ensureShipmentTables = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS order_shipments (
      id TEXT PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      delivery_method TEXT NOT NULL,
      source_station_id TEXT NOT NULL,
      source_station_snapshot JSONB,
      destination_station_id TEXT NOT NULL,
      destination_station_snapshot JSONB,
      offer_payload TEXT,
      request_id TEXT,
      status TEXT NOT NULL,
      status_raw JSONB,
      last_sync_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS order_shipment_status_history (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      payload_raw JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const mapShipmentRow = (row: ShipmentRow) => ({
  id: row.id,
  orderId: row.order_id,
  provider: row.provider,
  deliveryMethod: row.delivery_method,
  sourceStationId: row.source_station_id,
  sourceStationSnapshot: row.source_station_snapshot,
  destinationStationId: row.destination_station_id,
  destinationStationSnapshot: row.destination_station_snapshot,
  offerPayload: row.offer_payload,
  requestId: row.request_id,
  status: row.status,
  statusRaw: row.status_raw,
  lastSyncAt: row.last_sync_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as any) : {});
const readString = (obj: Record<string, unknown>, key: string): string => String(obj[key] ?? '').trim();

export const shipmentService = {
  ensure: ensureShipmentTables,
  isFinalStatus: (status: ShipmentInternalStatus) => FINAL_STATUSES.includes(status),

  getByOrderIds: async (orderIds: string[]) => {
    await ensureShipmentTables();
    if (!orderIds.length) return new Map<string, ReturnType<typeof mapShipmentRow>>();

    const rows = await prisma.$queryRawUnsafe<ShipmentRow[]>(
      `SELECT * FROM order_shipments WHERE order_id = ANY($1::text[])`,
      orderIds
    );

    return new Map(rows.map((row) => [row.order_id, mapShipmentRow(row)]));
  },

  getByOrderId: async (orderId: string) => {
    await ensureShipmentTables();
    const rows = await prisma.$queryRawUnsafe<ShipmentRow[]>(
      `SELECT * FROM order_shipments WHERE order_id = $1 LIMIT 1`,
      orderId
    );
    return rows[0] ? mapShipmentRow(rows[0]) : null;
  },

  getById: async (shipmentId: string) => {
    await ensureShipmentTables();
    const rows = await prisma.$queryRawUnsafe<ShipmentRow[]>(
      `SELECT * FROM order_shipments WHERE id = $1 LIMIT 1`,
      shipmentId
    );
    return rows[0] ? mapShipmentRow(rows[0]) : null;
  },

  upsertForOrder: async (payload: {
    orderId: string;
    deliveryMethod: 'COURIER' | 'PICKUP_POINT';
    sourceStationId: string;
    sourceStationSnapshot?: Record<string, unknown>;
    destinationStationId: string;
    destinationStationSnapshot?: Record<string, unknown>;
    offerPayload?: string | null;
    requestId?: string | null;
    status: ShipmentInternalStatus;
    statusRaw?: Record<string, unknown>;
    lastSyncAt?: Date | null;
  }) => {
    await ensureShipmentTables();
    const id = `sh_${payload.orderId}`;

    const rows = await prisma.$queryRawUnsafe<ShipmentRow[]>(
      `
      INSERT INTO order_shipments (
        id, order_id, provider, delivery_method,
        source_station_id, source_station_snapshot,
        destination_station_id, destination_station_snapshot,
        offer_payload, request_id, status, status_raw, last_sync_at, updated_at
      ) VALUES ($1, $2, 'CDEK', $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9, $10, $11::jsonb, $12, NOW())
      ON CONFLICT (order_id)
      DO UPDATE SET
        provider = EXCLUDED.provider,
        delivery_method = EXCLUDED.delivery_method,
        source_station_id = EXCLUDED.source_station_id,
        source_station_snapshot = EXCLUDED.source_station_snapshot,
        destination_station_id = EXCLUDED.destination_station_id,
        destination_station_snapshot = EXCLUDED.destination_station_snapshot,
        offer_payload = COALESCE(EXCLUDED.offer_payload, order_shipments.offer_payload),
        request_id = COALESCE(EXCLUDED.request_id, order_shipments.request_id),
        status = EXCLUDED.status,
        status_raw = EXCLUDED.status_raw,
        last_sync_at = EXCLUDED.last_sync_at,
        updated_at = NOW()
      RETURNING *
      `,
      id,
      payload.orderId,
      payload.deliveryMethod,
      payload.sourceStationId,
      JSON.stringify(payload.sourceStationSnapshot ?? null),
      payload.destinationStationId,
      JSON.stringify(payload.destinationStationSnapshot ?? null),
      payload.offerPayload ?? null,
      payload.requestId ?? null,
      payload.status,
      JSON.stringify(payload.statusRaw ?? null),
      payload.lastSyncAt ?? null
    );

    return mapShipmentRow(rows[0]);
  },

  pushHistory: async (shipmentId: string, status: ShipmentInternalStatus, payloadRaw: Record<string, unknown>) => {
    await ensureShipmentTables();
    await prisma.$executeRawUnsafe(
      `INSERT INTO order_shipment_status_history (id, shipment_id, status, payload_raw) VALUES ($1, $2, $3, $4::jsonb)`,
      `ssh_${shipmentId}_${Date.now()}`,
      shipmentId,
      status,
      JSON.stringify(payloadRaw)
    );
  },

  listForSync: async () => {
    await ensureShipmentTables();
    const rows = await prisma.$queryRawUnsafe<ShipmentRow[]>(
      `SELECT * FROM order_shipments WHERE request_id IS NOT NULL AND status NOT IN ('DELIVERED', 'CANCELLED', 'FAILED') ORDER BY updated_at ASC LIMIT 100`
    );
    return rows.map(mapShipmentRow);
  },

  /**
   * ✅ То, что у тебя вызывается из sellerRoutes:
   * shipmentService.readyToShipCdek(...)
   */
  readyToShipCdek: async (params: { orderId: string; sellerId: string }) => {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: {
        items: { include: { product: true } },
        contact: true,
        shippingAddress: true
      }
    });

    if (!order) {
      const err: any = new Error('ORDER_NOT_FOUND');
      err.code = 'ORDER_NOT_FOUND';
      throw err;
    }

    // Проверка что это заказ этого продавца (хотя бы по 1 item)
    const sellerItems = (order.items ?? []).filter((it: any) => String(it?.product?.sellerId ?? '') === params.sellerId);
    if (!sellerItems.length) {
      const err: any = new Error('SELLER_ORDER_ACCESS_DENIED');
      err.code = 'SELLER_ORDER_ACCESS_DENIED';
      throw err;
    }

    const settings = await prisma.sellerSettings.findUnique({ where: { sellerId: params.sellerId } });
    const fromPvzCode = String(settings?.defaultDropoffPvzId ?? '').trim();
    if (!fromPvzCode) {
      const err: any = new Error('CDEK_DROPOFF_PVZ_NOT_SET');
      err.code = 'CDEK_DROPOFF_PVZ_NOT_SET';
      throw err;
    }
    console.info('[CDEK][readyToShip] shippingAddress keys', {
      orderId: order.id,
      shippingAddress: order.shippingAddress
    });

    // 1) Если shippingAddress вообще нет, говорим честно
    if (!order.shippingAddress) {
      const err: any = new Error('ORDER_SHIPPING_ADDRESS_MISSING');
      err.code = 'ORDER_SHIPPING_ADDRESS_MISSING';
      throw err;
    }

    // 2) Достаём PVZ из shippingAddress
    const shipAddr = asRecord(order.shippingAddress as any);
    const toPvzCode =
      // сначала из shippingAddress
      (order.shippingAddress ? (
        readString(asRecord(order.shippingAddress as any), 'pvzId') ||
        readString(asRecord(order.shippingAddress as any), 'pvzCode') ||
        readString(asRecord(order.shippingAddress as any), 'pickupPointId') ||
        readString(asRecord(order.shippingAddress as any), 'pickupPointCode')
      ) : '') ||
      // fallback из Order (если такие поля реально есть)
      String((order as any).buyerPickupPvzId ?? '').trim() ||
      String((order as any).buyerPickupPointId ?? '').trim();

    if (!toPvzCode) {
      const err: any = new Error('CDEK_DESTINATION_PVZ_MISSING');
      err.code = 'CDEK_DESTINATION_PVZ_MISSING';
      err.debug = { shippingAddress: shipAddr };
      throw err;
    }

    const recipientName =
      String((order.contact as any)?.name ?? '').trim() ||
      String((order.contact as any)?.fullName ?? '').trim() ||
      'Получатель';

    const recipientPhone =
      String((order.contact as any)?.phone ?? '').trim() ||
      String((order.contact as any)?.phoneNumber ?? '').trim() ||
      '+70000000000';

    const items = sellerItems.map((it: any) => ({
      id: String(it.id ?? ''),
      name: String(it.product?.title ?? it.product?.name ?? 'Товар'),
      article: String(it.product?.sku ?? it.product?.id ?? ''),
      price: Number(it.priceAtPurchase ?? it.product?.price ?? 0),
      quantity: Number(it.quantity ?? 1)
    }));

    const created = await cdekService.createOrderFromMarketplaceOrder({
      orderId: order.id,
      fromPvzCode,
      toPvzCode,
      recipientName,
      recipientPhone,
      items,
      comment: `Order ${order.id}`
    });

    const shipment = await shipmentService.upsertForOrder({
      orderId: order.id,
      deliveryMethod: 'PICKUP_POINT',
      sourceStationId: fromPvzCode,
      destinationStationId: toPvzCode,
      requestId: created.cdekOrderId, // uuid заказа CDEK
      status: 'READY_TO_SHIP',
      statusRaw: { cdek_order_uuid: created.cdekOrderId, trackingNumber: created.trackingNumber },
      lastSyncAt: new Date()
    });

    await shipmentService.pushHistory(shipment.id, 'READY_TO_SHIP', { created });

    return {
      shipment,
      cdek: created
    };
  },

  /**
   * ✅ То, что у тебя вызывается из sellerRoutes:
   * shipmentService.getCdekShippingLabelPdf(...)
   */
  getCdekShippingLabelPdf: async (params: { orderId: string; sellerId: string }) => {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: { items: { include: { product: true } } }
    });

    if (!order) {
      const err: any = new Error('ORDER_NOT_FOUND');
      err.code = 'ORDER_NOT_FOUND';
      throw err;
    }

    const sellerItems = (order.items ?? []).filter((it: any) => String(it?.product?.sellerId ?? '') === params.sellerId);
    if (!sellerItems.length) {
      const err: any = new Error('SELLER_ORDER_ACCESS_DENIED');
      err.code = 'SELLER_ORDER_ACCESS_DENIED';
      throw err;
    }

    const shipment = await shipmentService.getByOrderId(order.id);
    if (!shipment || shipment.provider !== 'CDEK') {
      const err: any = new Error('CDEK_SHIPMENT_NOT_FOUND');
      err.code = 'CDEK_SHIPMENT_NOT_FOUND';
      throw err;
    }

    const raw = asRecord(shipment.statusRaw);
    const orderUuid = String(raw.cdek_order_uuid ?? shipment.requestId ?? '').trim();
    if (!orderUuid) {
      const err: any = new Error('CDEK_ORDER_UUID_MISSING');
      err.code = 'CDEK_ORDER_UUID_MISSING';
      throw err;
    }

    // Реальный запрос pdf (а не “придуманный метод”)
    return cdekService.getWaybillPdfByOrderUuid(orderUuid);
  }
};