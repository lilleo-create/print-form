import { Prisma, PaymentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { orderUseCases } from '../usecases/orderUseCases';
import { yandexNddClient } from './yandexNdd/YandexNddClient';
import { resolvePvzIds } from './yandexNdd/resolvePvzIds';
import { buildOffersCreatePayload } from './yandexNdd/nddOffersPayload';
import { looksLikePvzId } from './yandexNdd/nddIdSemantics';

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
    pvzId: string; // pvz self_pickup_id (uuid)
    buyerPickupPlatformStationId?: string; // platform_station_id (uuid) - важно!
    buyerPickupOperatorStationId?: string; // digits (не обязателен для request/create)
    addressFull?: string;
    raw?: unknown;
  };
};

const buildPaymentUrl = (paymentId: string) => `https://payment.local/checkout/${paymentId}`;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const normalizeUuid = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ? trimmed : null;
};

const normalizeDigits = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? trimmed : null;
};

const normalizeBuyerPickupPvz = (input: StartPaymentInput['buyerPickupPvz']) => {
  const raw = asRecord(input.raw) ?? {};

  // ✅ platform_station_id = UUID (а не digits!)
  const buyerPickupPlatformStationId =
    normalizeUuid(input.buyerPickupPlatformStationId) ??
    normalizeUuid(raw.buyerPickupPlatformStationId) ??
    normalizeUuid(raw.platform_station_id) ??
    normalizeUuid(raw.station_id) ?? // иногда так называют
    null;

  // digits операторская станция можно оставить как инфо
  const buyerPickupOperatorStationId =
    normalizeDigits(input.buyerPickupOperatorStationId) ??
    normalizeDigits(raw.buyerPickupOperatorStationId) ??
    normalizeDigits(raw.operator_station_id) ??
    null;

  const normalizedRaw = {
    ...raw,
    id: input.pvzId,
    buyerPickupPointId: input.pvzId,
    buyerPickupPlatformStationId,
    buyerPickupOperatorStationId,
    addressFull: input.addressFull ?? (typeof raw.addressFull === 'string' ? raw.addressFull : undefined),
    fullAddress: input.addressFull ?? (typeof raw.fullAddress === 'string' ? raw.fullAddress : undefined)
  };

  return {
    ...input,
    buyerPickupPlatformStationId: buyerPickupPlatformStationId ?? undefined,
    buyerPickupOperatorStationId: buyerPickupOperatorStationId ?? undefined,
    raw: normalizedRaw
  };
};

const buildOrderLabels = (orderId: string, packagesCount: number) => {
  const shortId = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(-7).toUpperCase();
  return Array.from({ length: packagesCount }, (_, index) => {
    const packageNo = index + 1;
    const base = `PF-${shortId}-${packageNo}`;
    return { packageNo, code: base.slice(0, 15) };
  });
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

  if (!order || order.status !== 'PAID' || order.yandexRequestId !== 'PROCESSING') return;
  if (!looksLikePvzId(order.sellerDropoffPvzId) || !looksLikePvzId(order.buyerPickupPvzId)) {
    console.warn('[PAYMENT][NDD] skip createDelivery: missing seller or buyer PVZ id', {
      orderId,
      sellerDropoffPvzId: order.sellerDropoffPvzId ?? null,
      buyerPickupPvzId: order.buyerPickupPvzId ?? null
    });
    await prisma.order.update({ where: { id: order.id }, data: { yandexRequestId: null, yandexStatus: 'CREATION_FAILED' } });
    return;
  }

  const sellerDropoffPvzId = String(order.sellerDropoffPvzId).trim();
  const buyerPickupPvzId = String(order.buyerPickupPvzId).trim();

  let requestId: string | null = null;
  try {
    const [sellerPvz, buyerPvz] = await Promise.all([
      resolvePvzIds(sellerDropoffPvzId),
      resolvePvzIds(buyerPickupPvzId)
    ]);

    console.info('[PAYMENT][NDD][offers]', {
      orderId,
      sellerDropoffPvzId,
      buyerPickupPvzId,
      resolved: {
        sourcePlatformId: sellerPvz.platformId,
        sourceOperatorStationId: sellerPvz.operatorStationId,
        destPlatformId: buyerPvz.platformId,
        destOperatorStationId: buyerPvz.operatorStationId
      }
    });

    const payload = buildOffersCreatePayload({
      order: order as any,
      sellerPvz,
      buyerPvz
    });

    const offersResponse = (await yandexNddClient.offersCreate(payload as Record<string, unknown>, {
      orderId: order.id,
      requestId: order.id
    })) as { offers?: Array<{ offer_id?: string }> };

    const offers = Array.isArray(offersResponse?.offers) ? offersResponse.offers : [];
    const firstOffer = offers[0];
    if (!firstOffer?.offer_id) {
      throw new Error('NDD_NO_OFFERS');
    }

    const confirmResponse = (await yandexNddClient.offersConfirm({
      offer_id: firstOffer.offer_id
    })) as { request_id?: string; status?: string; request?: { request_id?: string; status?: string; sharing_url?: string } };

    requestId = String(confirmResponse?.request_id ?? confirmResponse?.request?.request_id ?? '').trim();
    if (!requestId) {
      throw new Error('NDD_CONFIRM_NO_REQUEST_ID');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[PAYMENT][NDD] offers/create or offers/confirm failed', { orderId, msg });
    await prisma.order.update({ where: { id: order.id }, data: { yandexRequestId: null, yandexStatus: 'CREATION_FAILED' } });
    throw error;
  }

  let status: string | null = null;
  let sharingUrl: string | null = null;
  try {
    const info = (await yandexNddClient.requestInfo(requestId)) as { status?: string; sharing_url?: string; request?: { status?: string; sharing_url?: string } };
    status = info?.status ?? info?.request?.status ?? null;
    sharingUrl = info?.sharing_url ?? info?.request?.sharing_url ?? null;
  } catch {
    status = 'CREATED';
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      yandexRequestId: requestId,
      yandexStatus: status ?? undefined,
      yandexSharingUrl: sharingUrl ?? undefined
    }
  });
};

export const paymentFlowService = {
  async startPayment(input: StartPaymentInput) {
    const existingOrder = await prisma.order.findFirst({
      where: { buyerId: input.buyerId, paymentAttemptKey: input.paymentAttemptKey }
    });

    let order = existingOrder;
    const deliveryConfigMissing = false;
    const blockingReason: null = null;

    if (!order) {
      const product = await prisma.product.findFirst({
        where: { id: input.items[0]?.productId },
        select: { sellerId: true }
      });
      if (!product) throw new Error('PRODUCT_NOT_FOUND');

      const sellerSettings = await prisma.sellerSettings.findUnique({ where: { sellerId: product.sellerId } });

      try {
        const normalizedBuyerPickupPvz = normalizeBuyerPickupPvz(input.buyerPickupPvz);

        const createdOrder = await orderUseCases.create({
          buyerId: input.buyerId,
          paymentAttemptKey: input.paymentAttemptKey,
          buyerPickupPvz: normalizedBuyerPickupPvz,
          sellerDropoffPvz: sellerSettings?.defaultDropoffPvzId
            ? {
                provider: sellerSettings.defaultDropoffProvider === 'CDEK' ? 'CDEK' : 'YANDEX_NDD',
                pvzId: sellerSettings.defaultDropoffPvzId,
                raw: sellerSettings.defaultDropoffPvzMeta ?? {},
                addressFull:
                  typeof sellerSettings.defaultDropoffPvzMeta === 'object' && sellerSettings.defaultDropoffPvzMeta
                    ? String((sellerSettings.defaultDropoffPvzMeta as Record<string, unknown>).addressFull ?? '')
                    : undefined
              }
            : undefined,
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
      } catch (error) {
        const isUniqueViolation =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          Array.isArray(error.meta?.target) &&
          (error.meta?.target as string[]).includes('buyerId') &&
          (error.meta?.target as string[]).includes('paymentAttemptKey');

        if (!isUniqueViolation) throw error;

        order = await prisma.order.findFirst({
          where: { buyerId: input.buyerId, paymentAttemptKey: input.paymentAttemptKey }
        });
      }
    }

    if (!order) throw new Error('ORDER_CREATE_FAILED');

    const normalizedBuyerPickupPvz = normalizeBuyerPickupPvz(input.buyerPickupPvz);
    console.info('[PAYMENT][buyer_pvz]', {
      buyerId: input.buyerId,
      buyerPickupPvzId: input.buyerPickupPvz.pvzId,
      buyerPickupPlatformStationId: normalizedBuyerPickupPvz.buyerPickupPlatformStationId ?? null,
      buyerPickupOperatorStationId: normalizedBuyerPickupPvz.buyerPickupOperatorStationId ?? null,
      addressFull: input.buyerPickupPvz.addressFull ?? null
    });

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

    const existingPayment = await prisma.payment.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: 'desc' } });
    if (existingPayment) {
      const paymentUrl = String((existingPayment.payloadJson as Record<string, unknown> | null)?.paymentUrl ?? buildPaymentUrl(existingPayment.id));
      return { orderId: order.id, paymentId: existingPayment.id, paymentUrl, deliveryConfigMissing, blockingReason };
    }

    return prisma.$transaction(async (tx) => {
      const lockedOrder = await tx.order.findUnique({ where: { id: order.id } });
      if (!lockedOrder) throw new Error('ORDER_NOT_FOUND');

      if (lockedOrder.paymentId) {
        const lockedPayment = await tx.payment.findUnique({ where: { id: lockedOrder.paymentId } });
        if (lockedPayment) {
          const paymentUrl = String((lockedPayment.payloadJson as Record<string, unknown> | null)?.paymentUrl ?? buildPaymentUrl(lockedPayment.id));
          return { orderId: lockedOrder.id, paymentId: lockedPayment.id, paymentUrl, deliveryConfigMissing, blockingReason };
        }
      }

      const payment = await tx.payment.create({
        data: {
          orderId: lockedOrder.id,
          provider: 'manual',
          status: 'PENDING',
          amount: lockedOrder.total,
          currency: lockedOrder.currency,
          payloadJson: { paymentUrl: '' }
        }
      });

      const paymentUrl = buildPaymentUrl(payment.id);
      await tx.payment.update({ where: { id: payment.id }, data: { payloadJson: { paymentUrl } } });

      const claimed = await tx.order.updateMany({
        where: { id: lockedOrder.id, paymentId: null },
        data: { paymentId: payment.id, paymentProvider: payment.provider }
      });

      if (claimed.count === 0) {
        await tx.payment.delete({ where: { id: payment.id } });
        const existing = await tx.order.findUnique({ where: { id: lockedOrder.id } });
        if (existing?.paymentId) {
          const existingPayment2 = await tx.payment.findUnique({ where: { id: existing.paymentId } });
          if (existingPayment2) {
            const url = String((existingPayment2.payloadJson as Record<string, unknown> | null)?.paymentUrl ?? buildPaymentUrl(existingPayment2.id));
            return { orderId: existing.id, paymentId: existingPayment2.id, paymentUrl: url, deliveryConfigMissing, blockingReason };
          }
        }
      }

      return { orderId: lockedOrder.id, paymentId: payment.id, paymentUrl, deliveryConfigMissing, blockingReason };
    });
  },

  async mockSuccess(paymentId: string, buyerId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { buyerId: true } } }
    });

    if (!payment) return { ok: true };
    if (payment.order.buyerId !== buyerId) throw new Error('FORBIDDEN');

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
          where: { id: order.id, yandexRequestId: null },
          data: { yandexRequestId: 'PROCESSING' }
        });

        return { shouldCreateDelivery: claimed.count > 0 };
      });

      if (updated.shouldCreateDelivery) {
        await createDeliveryForPaidOrder(payment.orderId);
      }

      return { ok: true };
    }

    const paymentStatus: PaymentStatus = 'FAILED';

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: payment.orderId } });
      if (!order) return;
      await tx.payment.update({ where: { id: payment.id }, data: { status: paymentStatus } });
      if (order.status === 'PAID') return;
      await tx.order.update({ where: { id: order.id }, data: { status: 'CREATED' } });
    });

    return { ok: true };
  }
};
