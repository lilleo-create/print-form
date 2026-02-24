import { normalizeUuid, NddValidationError } from './nddIdSemantics';

export interface BuildOffersCreatePayloadInput {
  order: any;
  sellerPvz: any;
  buyerPvz: any;
}

export function buildOffersCreatePayload(
  input: BuildOffersCreatePayloadInput
): Record<string, unknown> {
  const { order, sellerPvz, buyerPvz } = input;

  const sourcePlatformId = normalizeUuid(
    sellerPvz?.platformId ?? sellerPvz?.platformStationId ?? sellerPvz?.pvzId ?? null
  );

  const destPlatformId = normalizeUuid(
    buyerPvz?.platformId ?? buyerPvz?.platformStationId ?? buyerPvz?.pvzId ?? null
  );

  if (!sourcePlatformId) {
    throw new NddValidationError(
      'sellerPvz.platformId (source platform_id) is required (uuid/32hex).',
      [{ field: 'sellerPvz.platformId', message: 'missing/invalid', value: sellerPvz }]
    );
  }

  if (!destPlatformId) {
    throw new NddValidationError(
      'buyerPvz.platformId (destination platform_id) is required (uuid/32hex).',
      [{ field: 'buyerPvz.platformId', message: 'missing/invalid', value: buyerPvz }]
    );
  }

  const items =
    order?.items?.map((item: any) => ({
      count: item.quantity ?? 1,
      cost_currency: order.currency ?? 'RUB',
      cost_value: String(item.priceAtPurchase ?? 0),
      title: item.product?.title ?? 'Item',
      weight: 1000
    })) ?? [];

  if (!items.length) {
    throw new NddValidationError('Order must contain at least one item.');
  }

  return {
    info: {
      operator_request_id: order.id
    },
    items,
    source: {
      platform_station: {
        platform_id: sourcePlatformId
      }
    },
    destination: {
      type: 'platform_station',
      platform_station: {
        platform_id: destPlatformId
      }
    }
  };
}