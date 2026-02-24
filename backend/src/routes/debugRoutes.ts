import { Router } from 'express';
import { resolvePvzIds } from '../services/yandexNdd/resolvePvzIds';
import { buildOffersCreatePayload } from '../services/yandexNdd/nddOffersPayload';
import { yandexNddClient } from '../services/yandexNdd/YandexNddClient';

export const debugRoutes = Router();

/**
 * POST /debug/ndd/offers (dev only)
 * Body: { sellerPvzId: string, buyerPvzId: string }
 * Returns: { offers, resolved } or 400 no_delivery_options / 400 validation
 */
debugRoutes.post('/ndd/offers', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Debug route disabled in production' } });
  }

  const sellerPvzId = typeof req.body?.sellerPvzId === 'string' ? req.body.sellerPvzId.trim() : '';
  const buyerPvzId = typeof req.body?.buyerPvzId === 'string' ? req.body.buyerPvzId.trim() : '';

  if (!sellerPvzId || !buyerPvzId) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'sellerPvzId and buyerPvzId required' },
      body: { sellerPvzId: sellerPvzId || null, buyerPvzId: buyerPvzId || null }
    });
  }

  (async () => {
    try {
      const [sellerPvz, buyerPvz] = await Promise.all([
        resolvePvzIds(sellerPvzId),
        resolvePvzIds(buyerPvzId)
      ]);

      const mockOrder = {
        id: 'debug-order',
        recipientName: 'Test User',
        recipientPhone: '+79990000000',
        recipientEmail: null,
        contact: null,
        buyer: null,
        items: [
          {
            quantity: 1,
            priceAtPurchase: 100,
            product: { title: 'Test', sku: 'SKU', dxCm: 10, dyCm: 10, dzCm: 10, weightGrossG: 100 },
            variant: { sku: 'SKU' }
          }
        ]
      };

      const payload = buildOffersCreatePayload({
        order: mockOrder as any,
        sellerPvz,
        buyerPvz
      });

      const offersResponse = (await yandexNddClient.offersCreate(payload as Record<string, unknown>, {
        requestId: 'debug',
        orderId: 'debug'
      })) as { offers?: unknown[] };

      const offers = Array.isArray(offersResponse?.offers) ? offersResponse.offers : [];

      res.status(200).json({
        offers,
        resolved: {
          source: { platformId: sellerPvz.platformId, operatorStationId: sellerPvz.operatorStationId },
          dest: { platformId: buyerPvz.platformId, operatorStationId: buyerPvz.operatorStationId }
        }
      });
    } catch (err: any) {
      const code = err?.code ?? err?.response?.data?.code;
      const isNoOptions =
        code === 'no_delivery_options' ||
        String(err?.message ?? '').includes('no_delivery_options') ||
        err?.response?.status === 400;
      if (isNoOptions) {
        res.status(400).json({
          error: { code: 'no_delivery_options', message: 'No delivery options for this PVZ pair' },
          details: err?.details ?? err?.response?.data ?? null
        });
        return;
      }
      next(err);
    }
  })();
});
