import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentFlowService } from './paymentFlowService';
import { prisma } from '../lib/prisma';

test('startPayment is idempotent by buyerId + paymentAttemptKey', async () => {
  let createdPayments = 0;
  (prisma.order.findFirst as any) = async () => ({ id: 'order-1', total: 100, currency: 'RUB' });
  (prisma.payment.findFirst as any) = async () => null;
  (prisma.payment.create as any) = async () => {
    createdPayments += 1;
    return { id: 'pay-1', provider: 'manual' };
  };
  (prisma.payment.update as any) = async () => ({});
  (prisma.order.update as any) = async () => ({});

  const first = await paymentFlowService.startPayment({
    buyerId: 'buyer-1',
    paymentAttemptKey: 'attempt-1',
    buyerPickupPvz: { provider: 'YANDEX_NDD', pvzId: 'pvz-1' },
    items: [{ productId: 'product-1', quantity: 1 }]
  });

  (prisma.payment.findFirst as any) = async () => ({ id: 'pay-1', payloadJson: { paymentUrl: 'https://payment.local/checkout/pay-1' } });

  const second = await paymentFlowService.startPayment({
    buyerId: 'buyer-1',
    paymentAttemptKey: 'attempt-1',
    buyerPickupPvz: { provider: 'YANDEX_NDD', pvzId: 'pvz-1' },
    items: [{ productId: 'product-1', quantity: 1 }]
  });

  assert.equal(first.orderId, second.orderId);
  assert.equal(createdPayments, 1);
});

test('webhook fail/cancel does not downgrade PAID order', async () => {
  (prisma.payment.findUnique as any) = async () => ({ id: 'pay-1', provider: 'manual', orderId: 'order-1', order: { id: 'order-1' } });
  let updatedOrderStatus: string | null = null;
  (prisma.$transaction as any) = async (cb: any) =>
    cb({
      order: {
        findUnique: async () => ({ id: 'order-1', status: 'PAID' }),
        update: async ({ data }: any) => {
          updatedOrderStatus = data.status;
        }
      },
      payment: {
        update: async () => ({})
      }
    });

  await paymentFlowService.processWebhook({ paymentId: 'pay-1', status: 'failed' });
  await paymentFlowService.processWebhook({ paymentId: 'pay-1', status: 'cancelled' });

  assert.equal(updatedOrderStatus, null);
});

import { yandexDeliveryService } from './yandexDeliveryService';

test('webhook success marks PAID and creates delivery only once', async () => {
  (prisma.payment.findUnique as any) = async () => ({ id: 'pay-1', provider: 'manual', orderId: 'order-1', order: { id: 'order-1' } });

  let txPass = 0;
  (prisma.$transaction as any) = async (cb: any) => {
    txPass += 1;
    return cb({
      order: {
        findUnique: async () => ({ id: 'order-1', status: txPass === 1 ? 'CREATED' : 'PAID' }),
        update: async () => ({}),
        updateMany: async () => ({ count: txPass === 1 ? 1 : 0 })
      },
      payment: {
        update: async () => ({})
      }
    });
  };

  (prisma.order.findUnique as any) = async () => ({
    id: 'order-1',
    status: 'PAID',
    yandexRequestId: 'PROCESSING',
    yandexOfferId: null,
    sellerDropoffPvzId: 's-1',
    buyerPickupPvzId: 'b-1',
    buyer: { name: 'User Name', email: 'u@test.dev', phone: '+7999' },
    contact: null,
    items: [
      {
        quantity: 1,
        priceAtPurchase: 100,
        product: { sku: 'sku', title: 'title', weightGrossG: 1000, dxCm: 10, dyCm: 10, dzCm: 10 },
        variant: null
      }
    ]
  });

  let deliveryCalls = 0;
  (yandexDeliveryService.createOffers as any) = async () => {
    deliveryCalls += 1;
    return { offers: [{ offer_id: 'offer-1', pricing_total: 10 }] };
  };
  (yandexDeliveryService.confirmOffer as any) = async () => ({ request_id: 'request-1' });
  (yandexDeliveryService.getRequestInfo as any) = async () => ({ status: 'CREATED' });
  (prisma.order.update as any) = async () => ({});

  await paymentFlowService.processWebhook({ paymentId: 'pay-1', status: 'success' });
  await paymentFlowService.processWebhook({ paymentId: 'pay-1', status: 'success' });

  assert.equal(deliveryCalls, 1);
});
