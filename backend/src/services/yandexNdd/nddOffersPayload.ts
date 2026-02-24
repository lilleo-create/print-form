/**
 * Builds payload for POST /api/b2b/platform/request/create?send_unix=true.
 */

import type { ResolvedPvzIds } from './nddTypes';

export type BuildRequestCreatePayloadInput = {
  merchantId: string;
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
 * Builds request/create payload. Assumes resolvePvzIds already normalized platformId to dashed UUID.
 */
export function buildRequestCreatePayload(
  input: BuildRequestCreatePayloadInput
): Record<string, unknown> {
  const { order, sellerPvz, buyerPvz, merchantId } = input;

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
        predefined_volume: 1000
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
    info: {
      operator_request_id: String(order.id),
      merchant_id: merchantId
    },

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

// Backward-compatible wrapper for legacy imports.
export const buildOffersCreatePayload = (input: Omit<BuildRequestCreatePayloadInput, 'merchantId'>) =>
  buildRequestCreatePayload({
    ...input,
    merchantId: String(process.env.YANDEX_NDD_MERCHANT_ID ?? process.env.YANDEX_MERCHANT_ID ?? '').trim()
  });
