/**
 * Builds payload for POST /api/b2b/platform/offers/create (method 3.01).
 * No merchant_id; source/destination use platform_station.platform_id (UUID dashed).
 */

import type { ResolvedPvzIds } from './nddTypes';

export type BuildOffersCreatePayloadInput = {
  order: {
    id: string;
    recipientName?: string | null;
    recipientPhone?: string | null;
    recipientEmail?: string | null;
    contact?: { name?: string; phone?: string; email?: string } | null;
    buyer?: { name?: string; phone?: string; email?: string } | null;
    items?: Array<{
      quantity: number;
      priceAtPurchase?: number;
      product?: {
        title?: string;
        sku?: string;
        dxCm?: number;
        dyCm?: number;
        dzCm?: number;
        weightGrossG?: number;
      };
      variant?: { sku?: string };
    }>;
  };
  sellerPvz: ResolvedPvzIds; // { platformId: uuid, operatorStationId: digits }
  buyerPvz: ResolvedPvzIds;  // { platformId: uuid, operatorStationId: digits }
};

/**
 * Builds offers/create payload. Assumes resolvePvzIds already normalized platformId to dashed UUID.
 */
export function buildOffersCreatePayload(
  input: BuildOffersCreatePayloadInput
): Record<string, unknown> {
  const { order, sellerPvz, buyerPvz } = input;

  const sourcePlatformId = sellerPvz.platformId;
  const destPlatformId = buyerPvz.platformId;

  const barcode = `PF-${order.id}`;

  const items = (order.items ?? []).map((it) => {
    const unitPrice = Number(it.priceAtPurchase ?? 0);

    return {
      article: it.variant?.sku ?? it.product?.sku ?? 'SKU',
      name: it.product?.title ?? 'Item',
      count: it.quantity ?? 1,
      place_barcode: barcode,
      billing_details: {
        unit_price: unitPrice,
        assessed_unit_price: unitPrice,
        nds: -1
      },
      physical_dims: {
        dx: it.product?.dxCm ?? 10,
        dy: it.product?.dyCm ?? 10,
        dz: it.product?.dzCm ?? 10,
        weight_gross: it.product?.weightGrossG ?? 100
      }
    };
  });

  const totalWeight = Math.max(
    100,
    (order.items ?? []).reduce((sum, it) => {
      const w = it.product?.weightGrossG ?? 0;
      const q = it.quantity ?? 1;
      return sum + w * q;
    }, 0)
  );

  const places = [
    {
      barcode,
      physical_dims: { dx: 10, dy: 10, dz: 10, weight_gross: totalWeight }
    }
  ];

  const fullName = String(
    order.recipientName ?? order.contact?.name ?? order.buyer?.name ?? 'Покупатель'
  ).trim();

  const [firstNameRaw, ...rest] = fullName.split(/\s+/);
  const firstName = firstNameRaw || 'Покупатель';
  const lastName = rest.join(' ') || '-';

  return {
    billing_info: { payment_method: 'already_paid' },
    info: { operator_request_id: String(order.id) },

    items,
    places,

    last_mile_policy: 'self_pickup',

    source: {
      platform_station: { platform_id: sourcePlatformId }
    },

    destination: {
      type: 'platform_station',
      platform_station: { platform_id: destPlatformId }
    },

    recipient_info: {
      first_name: firstName,
      last_name: lastName,
      phone: String(order.recipientPhone ?? order.contact?.phone ?? order.buyer?.phone ?? ''),
      email: order.recipientEmail ?? order.contact?.email ?? order.buyer?.email ?? undefined
    }
  };
}