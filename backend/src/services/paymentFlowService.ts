import { OrderStatus, Prisma, PaymentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { orderUseCases } from '../usecases/orderUseCases';
import { yandexDeliveryService } from './yandexDeliveryService';
import { payoutService } from './payoutService';

type StartPaymentInput = {
  buyerId: string;
  paymentAttemptKey: string;
  recipient: {
    name: string;
    phone: string;
    email?: string | null;
  };
  packagesCount?: number;
  items: { productId: string; variantId?: string; quantity: number }[];
  buyerPickupPvz: {
    provider: 'YANDEX_NDD';
    pvzId: string;
    addressFull?: string;
    raw?: unknown;
  };
};

const buildPaymentUrl = (paymentId: string) => `https://payment.local/checkout/${paymentId}`;

const buildOrderLabels = (orderId: string, packagesCount: number) => {
  const shortId = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(-7).toUpperCase();
  return Array.from({ length: packagesCount }, (_, index) => {
    const packageNo = index + 1;
    const base = `PF-${shortId}-${packageNo}`;
    return {
      packageNo,
      code: base.slice(0, 15)
    };
  });
};

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
    places: [{ barcode, physical_dims: { dx, dy, dz, weight_gross: weight } }],
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

const createDeliveryForPaidOrder = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: true,
      contact: true,
      items: { include: { product: true, variant: true } }
    }
  });

  if (!order || order.status !== 'PAID' || !order.yandexRequestId || order.yandexRequestId !== 'PROCESSING') {
    return;
  }

  const payload = buildYandexPayload(order);
  let requestId: string | null = null;
  let offerId: string | null = null;

  try {
    const offers = await yandexDeliveryService.createOffers(payload);
    const list = Array.isArray((offers as Record<string, unknown>).offers)
      ? ((offers as Record<string, unknown>).offers as Record<string, unknown>[])
      : [];
    const bestOffer = [...list].sort(
      (a, b) => Number((a.pricing_total as number) ?? Number.MAX_SAFE_INTEGER) - Number((b.pricing_total as number) ?? Number.MAX_SAFE_INTEGER)
    )[0];
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
    await prisma.order.update({ where: { id: order.id }, data: { yandexRequestId: null, yandexStatus: 'CREATION_FAILED' } });
    return;
  }

  const info = await yandexDeliveryService.getRequestInfo(requestId);
  await prisma.order.update({
    where: { id: order.id },
    data: {
      yandexOfferId: offerId,
      yandexRequestId: requestId,
      yandexStatus: (info as Record<string, unknown> | null)?.status as string | undefined,
      yandexSharingUrl: (info as Record<string, unknown> | null)?.sharing_url as string | undefined,
      yandexCourierOrderId: (info as Record<string, unknown> | null)?.courier_order_id as string | undefined,
      yandexSelfPickupCode: (info as Record<string, unknown> | null)?.self_pickup_node_code as object | undefined
    }
  });
};

export const paymentFlowService = {
  async startPayment(input: StartPaymentInput) {
    const existingOrder = await prisma.order.findFirst({
      where: { buyerId: input.buyerId, paymentAttemptKey: input.paymentAttemptKey }
    });

    let order = existingOrder;

    if (!order) {
      const product = await prisma.product.findFirst({
        where: { id: input.items[0]?.productId },
        select: { sellerId: true }
      });
      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      const sellerSettings = await prisma.sellerSettings.findUnique({ where: { sellerId: product.sellerId } });
      if (!sellerSettings?.defaultDropoffPvzId) {
        throw new Error('SELLER_DROPOFF_PVZ_REQUIRED');
      }

      const createdOrder = await orderUseCases.create({
        buyerId: input.buyerId,
        paymentAttemptKey: input.paymentAttemptKey,
        buyerPickupPvz: {
          ...input.buyerPickupPvz,
          raw: input.buyerPickupPvz.raw ?? {}
        },
        sellerDropoffPvz: {
          provider: 'YANDEX_NDD',
          pvzId: sellerSettings.defaultDropoffPvzId,
          raw: sellerSettings.defaultDropoffPvzMeta ?? {},
          addressFull:
            typeof sellerSettings.defaultDropoffPvzMeta === 'object' && sellerSettings.defaultDropoffPvzMeta
              ? String((sellerSettings.defaultDropoffPvzMeta as Record<string, unknown>).addressFull ?? '')
              : undefined
        },
        recipient: {
          name: input.recipient.name,
          phone: input.recipient.phone,
          email: input.recipient.email ?? null
        },
        packagesCount: input.packagesCount ?? 1,
        orderLabels: [],
        items: input.items
      });
      order = createdOrder;

      const labels = buildOrderLabels(createdOrder.id, createdOrder.packagesCount ?? input.packagesCount ?? 1);
      order = await prisma.order.update({ where: { id: createdOrder.id }, data: { orderLabels: labels } });
    }

    if (!order) {
      throw new Error('ORDER_CREATE_FAILED');
    }

    const shouldRefreshLabels = !order.orderLabels || !Array.isArray(order.orderLabels) || order.orderLabels.length === 0;
    const shouldUpdateRecipient = !order.recipientName || !order.recipientPhone;
    if (shouldRefreshLabels || shouldUpdateRecipient) {
      const labels = shouldRefreshLabels ? buildOrderLabels(order.id, order.packagesCount ?? input.packagesCount ?? 1) : order.orderLabels;
      order = await prisma.order.update({
        where: { id: order.id },
        data: {
          orderLabels: labels as Prisma.InputJsonValue,
          recipientName: shouldUpdateRecipient ? input.recipient.name : order.recipientName,
          recipientPhone: shouldUpdateRecipient ? input.recipient.phone : order.recipientPhone,
          recipientEmail: shouldUpdateRecipient ? input.recipient.email ?? null : order.recipientEmail
        }
      });
    }

    const existingPayment = await prisma.payment.findFirst({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' }
    });

    if (existingPayment) {
      const paymentUrl = String((existingPayment.payloadJson as Record<string, unknown> | null)?.paymentUrl ?? buildPaymentUrl(existingPayment.id));
      return { orderId: order.id, paymentId: existingPayment.id, paymentUrl };
    }

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'manual',
        status: 'PENDING',
        amount: order.total,
        currency: order.currency,
        payloadJson: { paymentUrl: '' }
      }
    });

    const paymentUrl = buildPaymentUrl(payment.id);
    await prisma.payment.update({ where: { id: payment.id }, data: { payloadJson: { paymentUrl } } });
    await prisma.order.update({ where: { id: order.id }, data: { paymentId: payment.id, paymentProvider: payment.provider } });

    return { orderId: order.id, paymentId: payment.id, paymentUrl };
  },

  async mockSuccess(paymentId: string, buyerId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { buyerId: true } } }
    });

    if (!payment) {
      return { ok: true };
    }

    if (payment.order.buyerId !== buyerId) {
      throw new Error('FORBIDDEN');
    }

    return this.processWebhook({ paymentId, status: 'success', provider: 'manual' });
  },

  async processWebhook(input: { paymentId: string; status: 'success' | 'failed' | 'cancelled' | 'expired'; provider?: string }) {
    const payment = await prisma.payment.findUnique({ where: { id: input.paymentId }, include: { order: true } });
    if (!payment) return { ok: true };

    if (input.status === 'success') {
      const updated = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: payment.orderId } });
        if (!order) return { shouldCreateDelivery: false };
        if (order.status === 'PAID') {
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED' } });
          return { shouldCreateDelivery: false };
        }

        await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED' } });

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            paymentProvider: input.provider ?? payment.provider,
            paymentId: payment.id,
            payoutStatus: 'HOLD'
          }
        });

        const claimed = await tx.order.updateMany({
          where: { id: order.id, yandexRequestId: null, yandexOfferId: null },
          data: { yandexRequestId: 'PROCESSING' }
        });

        return { shouldCreateDelivery: claimed.count > 0 };
      });

      if (updated.shouldCreateDelivery) {
        await createDeliveryForPaidOrder(payment.orderId);
      }
      return { ok: true };
    }

    const orderStatus: OrderStatus = input.status === 'failed' ? 'PAYMENT_FAILED' : 'CANCELLED';
    const paymentStatus: PaymentStatus = input.status === 'failed' ? 'FAILED' : 'FAILED';

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: payment.orderId } });
      if (!order) return;
      await tx.payment.update({ where: { id: payment.id }, data: { status: paymentStatus } });
      if (order.status === 'PAID') return;
      await tx.order.update({ where: { id: order.id }, data: { status: orderStatus } });
      await payoutService.blockForOrder(order.id, tx as any);
    });

    return { ok: true };
  }
};
