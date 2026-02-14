import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { yandexNddShipmentOrchestrator } from './yandexNddShipmentOrchestrator';
import { YandexNddHttpError, yandexNddClient } from './yandexNdd/YandexNddClient';

const sellerId = 'seller-1';

const mockPaidOrder = (id: string) => ({
  id,
  status: 'PAID',
  paidAt: new Date(),
  sellerDropoffPvzId: 'dropoff-1',
  sellerDropoffPvzMeta: { raw: { id: 'dropoff-1', operator_station_id: '10022023854' } },
  buyerPickupPvzId: 'pickup-1',
  buyerPickupPvzMeta: null,
  recipientName: 'Иван Иванов',
  recipientPhone: '+79990000001',
  shippingAddressId: null,
  contact: { name: 'Buyer Contact', phone: '+79990000001' },
  buyer: { name: 'Buyer User', phone: '+79990000002' },
  items: [
    {
      quantity: 2,
      priceAtPurchase: 1000,
      product: { title: 'Poster A3', sku: 'SKU-1', weightGrossG: 500, dxCm: 10, dyCm: 20, dzCm: 2 },
      variant: { sku: 'SKU-1-V1' }
    }
  ]
});

test('ready-to-ship when status CREATED returns ORDER_NOT_PAID and does not call NDD', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-4'),
    status: 'CREATED',
    paidAt: null
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
    ...mockPaidOrder('order-2'),
    sellerDropoffPvzId: null
  });

  await assert.rejects(() => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-2'), /PICKUP_POINT_REQUIRED/);
});

test('ready-to-ship calls offers/info -> offers/create -> offers/confirm in order', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-seq');
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-seq', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: 'pickup-1' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-seq' });

  const callOrder: string[] = [];
  (yandexNddClient.offersInfo as any) = async () => {
    callOrder.push('offersInfo');
    return { intervals: [{ from: 1700000000, to: 1700003600 }] };
  };
  (yandexNddClient.offersCreate as any) = async () => {
    callOrder.push('offersCreate');
    return { offer_id: 'offer-1' };
  };
  (yandexNddClient.offersConfirm as any) = async (body: Record<string, unknown>) => {
    callOrder.push('offersConfirm');
    assert.equal(body.offer_id, 'offer-1');
    return { request_id: 'request-1', status: 'CREATED' };
  };

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-seq');
  assert.deepEqual(callOrder, ['offersInfo', 'offersCreate', 'offersConfirm']);
});

test('ready-to-ship sends station_id/self_pickup_id and interval_utc from offers/info', async () => {
  process.env.YANDEX_NDD_OPERATOR_STATION_ID = 'station-env';

  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-7');
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-7', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: 'pickup-1' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-7' });

  const interval = { from: 1700001000, to: 1700004600 };
  let offersPayload: any = null;

  (yandexNddClient.offersInfo as any) = async () => ({ intervals_utc: [interval] });
  (yandexNddClient.offersCreate as any) = async (body: Record<string, any>) => {
    offersPayload = body;
    return { offer: { offer_id: 'offer-1' } };
  };
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-7');

  assert.equal(offersPayload?.station_id, 'station-env');
  assert.equal(offersPayload?.self_pickup_id, 'pickup-1');
  assert.deepEqual(offersPayload?.interval_utc, interval);
  assert.equal(offersPayload?.last_mile_policy, 'time_interval');
});

test('ready-to-ship fails with SELLER_STATION_ID_REQUIRED when station id is missing', async () => {
  delete process.env.YANDEX_NDD_OPERATOR_STATION_ID;
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-no-station'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });

  await assert.rejects(() => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-no-station'), /SELLER_STATION_ID_REQUIRED/);
});

test('ready-to-ship when NDD returns 400 variant maps NDD_OFFER_CREATE_FAILED', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-6');
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-6', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: 'pickup-1' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;

  (yandexNddClient.offersInfo as any) = async () => ({ intervals: [{ from: 1, to: 2 }] });
  (yandexNddClient.offersCreate as any) = async () => {
    throw new YandexNddHttpError('NDD_OFFER_CREATE_FAILED', '/api/b2b/platform/offers/create', 400, '{"message":"Value of source variant"}', {
      message: "Value of 'source' cannot be parsed as a variant"
    });
  };

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-6'),
    (err: any) => err instanceof YandexNddHttpError && err.code === 'NDD_OFFER_CREATE_FAILED' && String((err as any).details?.message).includes('variant')
  );
});


test('ready-to-ship falls back to request/create when offers/confirm has no request_id', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-request-create');
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-request-create', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: 'pickup-1' } }]]);

  const shipmentModule = await import('./shipmentService');
  let savedShipment: Record<string, unknown> | null = null;
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => {
    savedShipment = payload;
    return { id: 'shipment-1', ...payload };
  };
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-request-create' });

  (yandexNddClient.offersInfo as any) = async () => ({ intervals_utc: [{ from: 1, to: 2 }] });
  (yandexNddClient.offersCreate as any) = async () => ({ offer_id: 'offer-1' });
  (yandexNddClient.offersConfirm as any) = async () => ({ status: 'CREATED' });
  (yandexNddClient.requestCreate as any) = async (body: Record<string, unknown>) => {
    assert.equal(body.offer_id, 'offer-1');
    return { request_id: 'request-created' };
  };

  const shipment = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-request-create');

  assert.equal(shipment.requestId, 'request-created');
  assert.equal((savedShipment as any)?.requestId, 'request-created');
});

test('ready-to-ship is idempotent and returns existing shipment', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-1');

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-1', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: 'pickup-1' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => ({ id: 'ship-existing', requestId: 'req-existing' });

  let offersInfoCalled = 0;
  (yandexNddClient.offersInfo as any) = async () => {
    offersInfoCalled += 1;
    return { intervals: [] };
  };

  const result = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-1');
  assert.equal(result.id, 'ship-existing');
  assert.equal(offersInfoCalled, 0);
});
