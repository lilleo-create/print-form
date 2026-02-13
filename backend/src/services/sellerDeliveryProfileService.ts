import { prisma } from '../lib/prisma';

type SellerDeliveryProfile = {
  id: string;
  seller_id: string;
  dropoff_station_id: string;
  dropoff_station_meta: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  dropoffStationId?: string | null;
  dropoffStationMeta?: {
    addressFull?: string | null;
    [key: string]: any;
  } | null;
  dropoffPvz: {
    id: string;
    addressFull?: string;
  } | null;
};

const ensureSellerDeliveryProfileTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seller_delivery_profile (
      id TEXT PRIMARY KEY,
      seller_id TEXT UNIQUE NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      dropoff_station_id TEXT NOT NULL,
      dropoff_station_meta JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const rowToDto = (row: SellerDeliveryProfile) => ({
  id: row.id,
  sellerId: row.seller_id,
  dropoffStationId: row.dropoff_station_id,
  dropoffStationMeta: row.dropoff_station_meta,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const sellerDeliveryProfileService = {
  ensure: ensureSellerDeliveryProfileTable,
  getBySellerId: async (sellerId: string) => {
    await ensureSellerDeliveryProfileTable();
    const rows = await prisma.$queryRawUnsafe<SellerDeliveryProfile[]>(
      `SELECT * FROM seller_delivery_profile WHERE seller_id = $1 LIMIT 1`,
      sellerId
    );
    return rows[0] ? rowToDto(rows[0]) : null;
  },
  upsert: async (sellerId: string, payload: { dropoffStationId: string; dropoffStationMeta?: Record<string, unknown> }) => {
    await ensureSellerDeliveryProfileTable();
    const id = `sdp_${sellerId}`;
    const rows = await prisma.$queryRawUnsafe<SellerDeliveryProfile[]>(
      `
        INSERT INTO seller_delivery_profile (id, seller_id, dropoff_station_id, dropoff_station_meta, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, NOW())
        ON CONFLICT (seller_id)
        DO UPDATE SET dropoff_station_id = EXCLUDED.dropoff_station_id,
                      dropoff_station_meta = EXCLUDED.dropoff_station_meta,
                      updated_at = NOW()
        RETURNING *
      `,
      id,
      sellerId,
      payload.dropoffStationId,
      JSON.stringify(payload.dropoffStationMeta ?? null)
    );

    return rowToDto(rows[0]);
  }
};
