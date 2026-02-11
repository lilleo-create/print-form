import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { writeLimiter } from '../middleware/rateLimiters';
import { prisma } from '../lib/prisma';
import { orderUseCases } from '../usecases/orderUseCases';
import { yandexDeliveryService } from '../services/yandexDeliveryService';

export const orderRoutes = Router();

const yaPvzSelectionSchema = z.object({
  provider: z.literal('YANDEX_NDD'),
  pvzId: z.string().min(1),
  addressFull: z.string().optional(),
  country: z.string().optional(),
  locality: z.string().optional(),
  street: z.string().optional(),
  house: z.string().optional(),
  comment: z.string().optional(),
  raw: z.unknown()
});

const createOrderSchema = z.object({
  buyerPickupPvz: yaPvzSelectionSchema,
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().optional(),
        quantity: z.number().int().min(1)
      })
    )
    .min(1)
});

const buildYandexPayload = (order: any) => {
  const barcode = `PF-${order.id}`;
  const invalidItem = order.items.find(
    (item: any) =>
      item.product.weightGrossG == null ||
      item.product.dxCm == null ||
      item.product.dyCm == null ||
      item.product.dzCm == null
  );
  if (invalidItem) {
    throw new Error('PRODUCT_DIMENSIONS_REQUIRED');
  }

  const weight = order.items.reduce((sum: number, item: any) => sum + (item.product.weightGrossG ?? 0) * item.quantity, 0);
  const dx = Math.max(...order.items.map((item: any) => item.product.dxCm ?? 0));
  const dy = Math.max(...order.items.map((item: any) => item.product.dyCm ?? 0));
  const dz = Math.max(...order.items.map((item: any) => item.product.dzCm ?? 0));

  return {
    items: order.items.map((item: any) => ({
      article: item.variant?.sku ?? item.product.sku,
      name: item.product.title,
      count: item.quantity,
      place_barcode: barcode,
      billing_details: {
        unit_price: item.priceAtPurchase,
        assessed_unit_price: item.priceAtPurchase,
        nds: -1
      },
      physical_dims: {
        dx: item.product.dxCm,
        dy: item.product.dyCm,
        dz: item.product.dzCm,
        weight_gross: item.product.weightGrossG
      }
    })),
    places: [
      {
        barcode,
        physical_dims: {
          dx,
          dy,
          dz,
          weight_gross: weight
        }
      }
    ],
    last_mile_policy: 'self_pickup',
    source: { platform_station: { platform_id: order.sellerDropoffPvzId } },
    destination: { type: 'platform_station', platform_station: { platform_id: order.buyerPickupPvzId } },
    recipient_info: {
      first_name: order.buyer.name.split(' ')[0] ?? 'Покупатель',
      last_name: order.buyer.name.split(' ').slice(1).join(' ') || '-',
      phone: order.contact?.phone ?? order.buyer.phone ?? '',
      email: order.contact?.email ?? order.buyer.email
    },
    operator_request_id: order.id
  };
};

orderRoutes.post('/', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = createOrderSchema.parse(req.body);

    const product = await prisma.product.findFirst({
      where: { id: payload.items[0]?.productId },
      select: { sellerId: true }
    });

    if (!product) {
      return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND' } });
    }

    const sellerSettings = await prisma.sellerSettings.findUnique({ where: { sellerId: product.sellerId } });
    if (!sellerSettings?.defaultDropoffPvzId) {
      return res.status(400).json({ error: { code: 'SELLER_DROPOFF_PVZ_REQUIRED', message: 'Seller has no dropoff PVZ' } });
    }

    const order = await orderUseCases.create({
      buyerId: req.user!.userId,
      items: payload.items,
      buyerPickupPvz: {
        ...payload.buyerPickupPvz,
        raw: payload.buyerPickupPvz.raw ?? {}
      },
      sellerDropoffPvz: {
        provider: 'YANDEX_NDD',
        pvzId: sellerSettings.defaultDropoffPvzId,
        raw: sellerSettings.defaultDropoffPvzMeta ?? {},
        addressFull: typeof sellerSettings.defaultDropoffPvzMeta === 'object' && sellerSettings.defaultDropoffPvzMeta
          ? String((sellerSettings.defaultDropoffPvzMeta as Record<string, unknown>).addressFull ?? '')
          : undefined
      }
    });

    return res.status(201).json({ data: order, orderId: order.id });
  } catch (error) {
    return next(error);
  }
});

orderRoutes.post('/:id/pay', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, buyerId: req.user!.userId },
      include: {
        buyer: true,
        contact: true,
        items: { include: { product: true, variant: true } }
      }
    });

    if (!order) {
      return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND' } });
    }

    const payload = buildYandexPayload(order);

    let requestId: string | null = null;
    let offerId: string | null = null;
    try {
      const offers = await yandexDeliveryService.createOffers(payload);
      const list = Array.isArray((offers as Record<string, unknown>).offers)
        ? ((offers as Record<string, unknown>).offers as Record<string, unknown>[])
        : [];
      const bestOffer = [...list].sort((a, b) => Number((a.pricing_total as number) ?? Number.MAX_SAFE_INTEGER) - Number((b.pricing_total as number) ?? Number.MAX_SAFE_INTEGER))[0];
      if (bestOffer?.offer_id) {
        offerId = String(bestOffer.offer_id);
        const confirmed = await yandexDeliveryService.confirmOffer(offerId);
        requestId = String((confirmed as Record<string, unknown>).request_id ?? '');
      }
    } catch (_error) {
      const created = await yandexDeliveryService.createRequest(payload);
      requestId = String((created as Record<string, unknown>).request_id ?? '');
    }

    if (!requestId) {
      return res.status(400).json({ error: { code: 'YANDEX_REQUEST_FAILED' } });
    }

    const info = await yandexDeliveryService.getRequestInfo(requestId);

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        yandexOfferId: offerId,
        yandexRequestId: requestId,
        yandexStatus: (info as Record<string, unknown> | null)?.status as string | undefined,
        yandexSharingUrl: (info as Record<string, unknown> | null)?.sharing_url as string | undefined,
        yandexCourierOrderId: (info as Record<string, unknown> | null)?.courier_order_id as string | undefined,
        yandexSelfPickupCode: (info as Record<string, unknown> | null)?.self_pickup_node_code as object | undefined
      }
    });

    return res.json({ data: updated, trackingUrl: updated.yandexSharingUrl });
  } catch (error) {
    if (error instanceof Error && error.message === 'PRODUCT_DIMENSIONS_REQUIRED') {
      return res.status(400).json({ error: { code: 'PRODUCT_DIMENSIONS_REQUIRED', message: 'Продавец не указал габариты/вес товара' } });
    }
    return next(error);
  }
});

orderRoutes.post('/:id/ready-for-shipment', authenticate, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        status: 'PAID',
        items: { some: { product: { sellerId: req.user!.userId } } }
      }
    });

    if (!order) {
      return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND' } });
    }

    const now = new Date();
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'READY_FOR_SHIPMENT',
        readyForShipmentAt: now,
        dropoffDeadlineAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    return res.json({ data: updated });
  } catch (error) {
    return next(error);
  }
});

orderRoutes.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { buyerId: req.user!.userId },
      include: { items: { include: { product: true, variant: true } }, deliveryEvents: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ data: orders });
  } catch (error) {
    next(error);
  }
});

orderRoutes.get('/:id/delivery/history', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        OR: [{ buyerId: req.user!.userId }, { items: { some: { product: { sellerId: req.user!.userId } } } }]
      },
      include: { deliveryEvents: { orderBy: { createdAt: 'desc' } } }
    });
    if (!order) {
      return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
    return res.json({ data: order.deliveryEvents });
  } catch (error) {
    return next(error);
  }
});

orderRoutes.get('/:id', authenticate, async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        OR: [{ buyerId: req.user!.userId }, { items: { some: { product: { sellerId: req.user!.userId } } } }]
      },
      include: {
        items: { include: { product: true, variant: true } },
        contact: true,
        shippingAddress: true,
        buyer: true,
        deliveryEvents: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!order) {
      return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
    return res.json({ data: order });
  } catch (error) {
    return next(error);
  }
});
