import { prisma } from '../lib/prisma';

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

export const shipmentService = {
  ensure: ensureShipmentTables,
  isFinalStatus: (status: ShipmentInternalStatus) => FINAL_STATUSES.includes(status),
  getByOrderIds: async (orderIds: string[]) => {
    await ensureShipmentTables();
    if (!orderIds.length) {
      return new Map<string, ReturnType<typeof mapShipmentRow>>();
    }

    const rows = await prisma.$queryRawUnsafe<ShipmentRow[]>(
      `SELECT * FROM order_shipments WHERE order_id = ANY($1::text[])`,
      orderIds
    );

    return new Map(rows.map((row) => [row.order_id, mapShipmentRow(row)]));
  },
  getByOrderId: async (orderId: string) => {
    await ensureShipmentTables();
    const rows = await prisma.$queryRawUnsafe<ShipmentRow[]>(`SELECT * FROM order_shipments WHERE order_id = $1 LIMIT 1`, orderId);
    return rows[0] ? mapShipmentRow(rows[0]) : null;
  },
  getById: async (shipmentId: string) => {
    await ensureShipmentTables();
    const rows = await prisma.$queryRawUnsafe<ShipmentRow[]>(`SELECT * FROM order_shipments WHERE id = $1 LIMIT 1`, shipmentId);
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
      ) VALUES ($1, $2, 'YANDEX_NDD', $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9, $10, $11::jsonb, $12, NOW())
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
  }
};
