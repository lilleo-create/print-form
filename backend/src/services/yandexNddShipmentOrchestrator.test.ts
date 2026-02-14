import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { yandexNddShipmentOrchestrator } from './yandexNddShipmentOrchestrator';
import { YandexNddHttpError, yandexNddClient } from './yandexNdd/YandexNddClient';

const sellerId = 'seller-1';

test('ready-to-ship when status CREATED returns ORDER_NOT_PAID and does not call NDD', async () => {
  (prisma.order.findFirst as any) = async () => ({
    id: 'order-4',
    status: 'CREATED',
    paidAt: null,
    sellerDropoffPvzId: 'dropoff-1',
    buyerPickupPvzId: 'pickup-1',
    shippingAddressId: null,
    contact: null,
    buyer: { name: 'Buyer', phone: '+7999' }
  });

  let offersCalled = 0;
  (yandexNddClient.offersCreate as any) = async () => {
    offersCalled += 1;
    return { offers: [] };
  };

  await assert.rejects(() => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-4'), /ORDER_NOT_PAID/);
  assert.equal(offersCalled, 0);
});

test('ready-to-ship fails with PICKUP_POINT_REQUIRED', async () => {
  (prisma.order.findFirst as any) = async () => ({
    id: 'order-2',
    status: 'PAID',
    paidAt: new Date(),
    sellerDropoffPvzId: null,
    buyerPickupPvzId: 'pickup-1',
    shippingAddressId: null,
    contact: null,
    buyer: { name: 'Buyer', phone: '+7999' }
  });

  await assert.rejects(() => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-2'), /PICKUP_POINT_REQUIRED/);
});

test('ready-to-ship is idempotent and returns existing shipment', async () => {
  (prisma.order.findFirst as any) = async () => ({
    id: 'order-1',
    status: 'PAID',
    paidAt: new Date(),
    sellerDropoffPvzId: 'dropoff-1',
    sellerDropoffPvzMeta: null,
    buyerPickupPvzId: 'pickup-1',
    buyerPickupPvzMeta: null,
    shippingAddressId: null,
    contact: { name: 'Buyer', phone: '+7999' },
    buyer: { name: 'Buyer', phone: '+7999' }
  });

const deliveryServiceModule = await import('./orderDeliveryService');
(deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
  new Map([['order-1', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: 'pickup-1' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => ({ id: 'ship-existing', requestId: 'req-existing' });

  let offersCalled = 0;
  (yandexNddClient.offersCreate as any) = async () => {
    offersCalled += 1;
    return { offers: [] };
  };

  const result = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-1');
  assert.equal(result.id, 'ship-existing');
  assert.equal(offersCalled, 0);
});

test('ready-to-ship when NDD returns 403 no_permissions bubbles Ndd error and order unchanged', async () => {
  (prisma.order.findFirst as any) = async () => ({
    id: 'order-6',
    status: 'PAID',
    paidAt: new Date(),
    sellerDropoffPvzId: 'dropoff-1',
    sellerDropoffPvzMeta: null,
    buyerPickupPvzId: 'pickup-1',
    buyerPickupPvzMeta: null,
    shippingAddressId: null,
    contact: { name: 'Buyer', phone: '+7999' },
    buyer: { name: 'Buyer', phone: '+7999' }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-6', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: 'pickup-1' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async () => {
    throw new Error('MUST_NOT_CREATE_SHIPMENT');
  };

  let orderUpdateCalled = 0;
  (prisma.order.update as any) = async () => {
    orderUpdateCalled += 1;
    return {};
  };

  (yandexNddClient.offersCreate as any) = async () => {
    throw new YandexNddHttpError('NDD_REQUEST_FAILED', '/api/b2b/platform/offers/create', 403, '{"code":"no_permissions"}', {
      code: 'no_permissions'
    });
  };

  await assert.rejects(() => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-6'), (err: any) => err instanceof YandexNddHttpError);
  assert.equal(orderUpdateCalled, 0);
});

test('ready-to-ship sends mandatory billing_info to offers/create', async () => {
  (prisma.order.findFirst as any) = async () => ({
    id: 'order-7',
    status: 'PAID',
    paidAt: new Date(),
    sellerDropoffPvzId: 'dropoff-1',
    sellerDropoffPvzMeta: null,
    buyerPickupPvzId: 'pickup-1',
    buyerPickupPvzMeta: null,
    shippingAddressId: null,
    contact: { name: 'Buyer', phone: '+7999' },
    buyer: { name: 'Buyer', phone: '+7999' }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-7', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: 'pickup-1' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;

  let offersPayload: Record<string, unknown> | null = null;
  (yandexNddClient.offersCreate as any) = async (body: Record<string, unknown>) => {
    offersPayload = body;
    return { offers: [{ offer_id: 'offer-1', price: { amount: 100 } }] };
  };
  (yandexNddClient.offersConfirm as any) = async () => ({ ok: true });
  (yandexNddClient.requestCreate as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({});

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-7');

  assert.deepEqual((offersPayload as any).billing_info, {
    delivery_cost: 0,
    payment_method: 'already_paid'
  });
  assert.equal((offersPayload as any).request_id, undefined);
  assert.deepEqual((offersPayload as any).places?.[0]?.physical_dims, {
    weight_gross: 500,
    dx: 10,
    dy: 10,
    dz: 10
  });
});
