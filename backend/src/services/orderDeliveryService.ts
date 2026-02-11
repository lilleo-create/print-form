import { prisma } from '../lib/prisma';

export type DeliveryMethod = 'COURIER' | 'PICKUP_POINT';

export type CourierAddress = {
  line1?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  apartment?: string | null;
  floor?: string | null;
  comment?: string | null;
};

export type PickupPoint = {
  id: string;
  fullAddress: string;
  country?: string;
  locality?: string;
  street?: string;
  house?: string;
  comment?: string;
  position?: Record<string, unknown>;
  type?: string;
  paymentMethods?: string[];
};

export type OrderDeliveryData = {
  deliveryProvider: string;
  deliveryMethod: DeliveryMethod;
  courierAddress: CourierAddress | null;
  pickupPoint: PickupPoint | null;
  deliveryMeta: Record<string, unknown>;
};

type OrderDeliveryRow = {
  order_id: string;
  delivery_payload: OrderDeliveryData;
};

let setupPromise: Promise<void> | null = null;

const ensureOrderDeliveryTable = async () => {
  if (!setupPromise) {
    setupPromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS order_delivery_data (
        order_id TEXT PRIMARY KEY,
        delivery_payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(() => undefined);
  }

  return setupPromise;
};

export const orderDeliveryService = {
  ensure: ensureOrderDeliveryTable,
  upsert: async (orderId: string, payload: OrderDeliveryData) => {
    await ensureOrderDeliveryTable();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO order_delivery_data (order_id, delivery_payload, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (order_id)
        DO UPDATE SET delivery_payload = EXCLUDED.delivery_payload,
          updated_at = NOW()
      `,
      orderId,
      JSON.stringify(payload)
    );
  },
  getByOrderIds: async (orderIds: string[]) => {
    await ensureOrderDeliveryTable();
    if (orderIds.length === 0) {
      return new Map<string, OrderDeliveryData>();
    }

    const rows = await prisma.$queryRawUnsafe<OrderDeliveryRow[]>(
      `SELECT order_id, delivery_payload
       FROM order_delivery_data
       WHERE order_id = ANY($1::text[])`,
      orderIds
    );

    return new Map(rows.map((row) => [row.order_id, row.delivery_payload]));
  }
};
