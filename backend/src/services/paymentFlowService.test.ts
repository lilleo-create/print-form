import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentFlowService } from './paymentFlowService';
import { prisma } from '../lib/prisma';
import { orderUseCases } from '../usecases/orderUseCases';

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
    recipient: { name: 'Иван Иванов', phone: '+79990000000', email: 'ivan@test.dev' },
    buyerPickupPvz: { provider: 'YANDEX_NDD', pvzId: 'pvz-1' },
    items: [{ productId: 'product-1', quantity: 1 }]
  });

  (prisma.payment.findFirst as any) = async () => ({ id: 'pay-1', payloadJson: { paymentUrl: 'https://payment.local/checkout/pay-1' } });

  const second = await paymentFlowService.startPayment({
    buyerId: 'buyer-1',
    paymentAttemptKey: 'attempt-1',
    recipient: { name: 'Иван Иванов', phone: '+79990000000', email: 'ivan@test.dev' },
    buyerPickupPvz: { provider: 'YANDEX_NDD', pvzId: 'pvz-1' },
    items: [{ productId: 'product-1', quantity: 1 }]
  });

  assert.equal(first.orderId, second.orderId);
  assert.equal(first.paymentUrl, second.paymentUrl);
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

test('startPayment stores recipient and default packagesCount=1', async () => {
  (prisma.order.findFirst as any) = async () => null;
  (prisma.product.findFirst as any) = async () => ({ sellerId: 'seller-1' });
  (prisma.sellerSettings.findUnique as any) = async () => ({
    defaultDropoffPvzId: 'dropoff-1',
    defaultDropoffPvzMeta: { addressFull: 'Dropoff' }
  });

  let createPayload: any = null;
  (orderUseCases as any).create = async (payload: any) => {
    createPayload = payload;
    return { id: 'order-2', total: 500, currency: 'RUB', packagesCount: 1, orderLabels: [] };
  };

  (prisma.order.update as any) = async ({ data }: any) => ({ id: 'order-2', total: 500, currency: 'RUB', ...data });
  (prisma.payment.findFirst as any) = async () => null;
  (prisma.payment.create as any) = async () => ({ id: 'pay-2', provider: 'manual' });
  (prisma.payment.update as any) = async () => ({});

  await paymentFlowService.startPayment({
    buyerId: 'buyer-2',
    paymentAttemptKey: 'attempt-2',
    recipient: { name: 'Петр Петров', phone: '+79998887766' },
    buyerPickupPvz: { provider: 'YANDEX_NDD', pvzId: 'pvz-2' },
    items: [{ productId: 'product-1', quantity: 1 }]
  });

  assert.equal(createPayload.recipient.name, 'Петр Петров');
  assert.equal(createPayload.recipient.phone, '+79998887766');
  assert.equal(createPayload.packagesCount, 1);
});

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


test('webhook success sets payoutStatus HOLD and does not create payout', async () => {
  (prisma.payment.findUnique as any) = async () => ({ id: 'pay-3', provider: 'manual', orderId: 'order-3', order: { id: 'order-3' } });

  let updatedOrderData: any = null;
  (prisma.$transaction as any) = async (cb: any) =>
    cb({
      order: {
        findUnique: async () => ({ id: 'order-3', status: 'CREATED' }),
        update: async ({ data }: any) => {
          updatedOrderData = data;
          return {};
        },
        updateMany: async () => ({ count: 0 })
      },
      payment: { update: async () => ({}) }
    });

  await paymentFlowService.processWebhook({ paymentId: 'pay-3', status: 'success' });

  assert.equal(updatedOrderData.payoutStatus, 'HOLD');
});

test('webhook cancel blocks payout status for unpaid order', async () => {
  (prisma.payment.findUnique as any) = async () => ({ id: 'pay-4', provider: 'manual', orderId: 'order-4', order: { id: 'order-4' } });

  let blocked = false;
  (prisma.$transaction as any) = async (cb: any) =>
    cb({
      order: {
        findUnique: async () => ({ id: 'order-4', status: 'CREATED' }),
        update: async () => ({}),
      },
      payment: { update: async () => ({}) },
      payout: { },
    });

  const payoutModule = await import('./payoutService');
  (payoutModule.payoutService.blockForOrder as any) = async () => { blocked = true; };

  await paymentFlowService.processWebhook({ paymentId: 'pay-4', status: 'cancelled' });
  assert.equal(blocked, true);
});

test('mock-success marks order as PAID and sets paidAt', async () => {
  (prisma.payment.findUnique as any) = async () => ({ id: 'pay-mock-1', provider: 'manual', orderId: 'order-mock-1' });

  let updatedOrderData: any = null;
  let updatedPaymentData: any = null;
  (prisma.$transaction as any) = async (cb: any) =>
    cb({
      order: {
        findUnique: async () => ({ id: 'order-mock-1', status: 'CREATED' }),
        update: async ({ data }: any) => {
          updatedOrderData = data;
          return {};
        }
      },
      payment: {
        update: async ({ data }: any) => {
          updatedPaymentData = data;
          return {};
        }
      }
    });

  await paymentFlowService.mockSuccess('pay-mock-1');

  assert.equal(updatedPaymentData.status, 'SUCCEEDED');
  assert.equal(updatedOrderData.status, 'PAID');
  assert.equal(updatedOrderData.payoutStatus, 'HOLD');
  assert.ok(updatedOrderData.paidAt instanceof Date);
});
