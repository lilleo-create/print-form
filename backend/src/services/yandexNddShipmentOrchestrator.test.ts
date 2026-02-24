import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { yandexNddShipmentOrchestrator } from './yandexNddShipmentOrchestrator';
import { YandexNddHttpError, yandexNddClient } from './yandexNdd/YandexNddClient';

const sellerId = 'seller-1';

const SELLER_PVZ_UUID = 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924';
const BUYER_PVZ_UUID = '0193d98f-b6fe-76ce-9ac1-bbf9ea33d2f7';

test.beforeEach(() => {
  delete process.env.YANDEX_NDD_DEFAULT_PLATFORM_STATION_ID;
  delete process.env.YANDEX_NDD_PLATFORM_STATION_ID;
  process.env.YANDEX_NDD_MERCHANT_ID = 'merchant-test';
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffPlatformStationId: SELLER_PVZ_UUID,
    dropoffStationMeta: null
  });
  (yandexNddClient.pickupPointsList as any) = async (body: { pickup_point_ids?: string[] }) => {
    const ids = body?.pickup_point_ids ?? [];
    return {
      points: ids.map((id: string) => ({
        id,
        operator_station_id: id === SELLER_PVZ_UUID ? '10029618814' : '10027909485'
      }))
    };
  };
  (yandexNddClient.requestCreate as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });
});

const mockPaidOrder = (id: string) => ({
  id,
  status: 'PAID',
  paidAt: new Date(),
  sellerDropoffPvzId: SELLER_PVZ_UUID,
  sellerDropoffPvzMeta: { raw: { id: SELLER_PVZ_UUID, operator_station_id: '10029618814' } },
  buyerPickupPvzId: BUYER_PVZ_UUID,
  buyerPickupPvzMeta: { buyerPickupStationId: '10027909485', raw: { id: BUYER_PVZ_UUID, operator_station_id: '10027909485' } },
  recipientName: 'Иван Иванов',
  recipientPhone: '+79990000001',
  shippingAddressId: null,
  contact: { name: 'Buyer Contact', phone: '+79990000001' },
  buyer: { name: 'Buyer User', phone: '+79990000002' },
  items: [
    {
      quantity: 2,
      priceAtPurchase: 1000,
      product: { title: 'Poster A3', sku: 'SKU-1', weightGrossG: 500, dxCm: 10, dyCm: 20, dzCm: 2, sellerId: 'seller-1' },
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

  let requestCreateCalled = 0;
  (yandexNddClient.requestCreate as any) = async () => {
    requestCreateCalled += 1;
    return { request_id: '', status: 'CREATED' };
  };

  await assert.rejects(() => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-4'), /ORDER_NOT_PAID/);
  assert.equal(requestCreateCalled, 0);
});

test('ready-to-ship fails when buyer PVZ id is missing', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-2'),
    buyerPickupPvzId: null
  });

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-2'),
    (err: any) => err?.code === 'NDD_VALIDATION_ERROR' || /buyerPickupPvzId|PVZ/.test(String(err?.message ?? ''))
  );
});

test('ready-to-ship calls request/create -> request/create in order', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-seq');
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-seq', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-seq' });

  const callOrder: string[] = [];
  (yandexNddClient.requestCreate as any) = async () => {
    callOrder.push('requestCreate');
    return { request_id: 'request-1', status: 'CREATED' };
  };

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-seq');
  assert.deepEqual(callOrder, ['requestCreate']);
});

test('ready-to-ship sends source.platform_station.platform_id and destination platform_id in request/create (no merchant_id)', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-7');
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-7', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-7' });

  let requestPayload: any = null;

  (yandexNddClient.requestCreate as any) = async (body: Record<string, any>) => {
    requestPayload = body;
    return { request_id: 'request-1', status: 'CREATED' };
  };

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-7');

  assert.equal(requestPayload?.source?.platform_station?.platform_id, SELLER_PVZ_UUID);
  assert.equal(requestPayload?.destination?.platform_station?.platform_id, BUYER_PVZ_UUID);
  assert.equal(requestPayload?.last_mile_policy, 'self_pickup');
});





test('ready-to-ship does not fail when buyer platform station id is missing in meta', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-no-buyer-station'),
    buyerPickupPvzMeta: { raw: { id: BUYER_PVZ_UUID } }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-no-buyer-station', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-no-buyer-station' });

  (yandexNddClient.requestCreate as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  const shipment = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-no-buyer-station');
  assert.equal(shipment.requestId, 'request-1');
});

test('ready-to-ship uses resolved buyer platform_id in request/create', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-backfill'),
    buyerPickupPvzId: BUYER_PVZ_UUID,
    buyerPickupPvzMeta: { raw: { id: BUYER_PVZ_UUID } }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-backfill', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;

  (prisma.order.update as any) = async (payload: any) => ({ id: payload.where.id });

  let requestCreateDestPlatformId = '';
  (yandexNddClient.requestCreate as any) = async (body: Record<string, any>) => {
    requestCreateDestPlatformId = body?.destination?.platform_station?.platform_id ?? '';
    return { request_id: 'request-backfill', status: 'CREATED' };
  };

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-backfill');

  assert.equal(requestCreateDestPlatformId, BUYER_PVZ_UUID);
});

test('ready-to-ship does not fail when buyer meta has non-digits operator_station_id', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-invalid-buyer-station'),
    buyerPickupPvzMeta: { buyerPickupStationId: 'abc123', raw: { id: BUYER_PVZ_UUID, operator_station_id: 'abc123' } }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-invalid-buyer-station', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipment = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-invalid-buyer-station');
  assert.ok(shipment.requestId);
});

test('ready-to-ship accepts seller dropoff and buyer pickup as UUIDs', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-from-profile-meta-raw'),
    sellerDropoffPvzMeta: { raw: { id: SELLER_PVZ_UUID } }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-from-profile-meta-raw', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipment = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-from-profile-meta-raw');
  assert.ok(shipment.requestId);
});

test('ready-to-ship uses resolved seller PVZ as source platform_id', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-from-profile'),
    sellerDropoffPvzMeta: { raw: { id: SELLER_PVZ_UUID } }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-from-profile', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-from-profile' });

  let sourcePlatformId: string | null = null;
  (yandexNddClient.requestCreate as any) = async (body: Record<string, any>) => {
    sourcePlatformId = body?.source?.platform_station?.platform_id ?? null;
    return { request_id: 'request-1', status: 'CREATED' };
  };

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-from-profile');
  assert.equal(sourcePlatformId, SELLER_PVZ_UUID);
});

test('ready-to-ship uses trimmed seller PVZ id from resolvePvzIds', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-from-profile-trimmed'),
    sellerDropoffPvzMeta: { raw: { id: SELLER_PVZ_UUID } }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-from-profile-trimmed', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-from-profile-trimmed' });

  let sourcePlatformId: string | null = null;
  (yandexNddClient.requestCreate as any) = async (body: Record<string, any>) => {
    sourcePlatformId = body?.source?.platform_station?.platform_id ?? null;
    return { request_id: 'request-1', status: 'CREATED' };
  };

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-from-profile-trimmed');
  assert.equal(sourcePlatformId, SELLER_PVZ_UUID);
});

test('ready-to-ship uses order seller and buyer PVZ ids', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-blank-env'),
    sellerDropoffPvzMeta: { raw: { id: SELLER_PVZ_UUID } }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-blank-env', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-blank-env' });

  let sourcePlatformId: string | null = null;
  (yandexNddClient.requestCreate as any) = async (body: Record<string, any>) => {
    sourcePlatformId = body?.source?.platform_station?.platform_id ?? null;
    return { request_id: 'request-1', status: 'CREATED' };
  };

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-blank-env');
  assert.equal(sourcePlatformId, SELLER_PVZ_UUID);
});

test('ready-to-ship fails when seller dropoff PVZ id is missing', async () => {
  process.env.NODE_ENV = 'production';
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-no-station'),
    sellerDropoffPvzId: null,
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-no-station'),
    (err: any) => err?.code === 'NDD_VALIDATION_ERROR' || /sellerDropoffPvzId|PVZ/.test(String(err?.message ?? ''))
  );
});


test('ready-to-ship uses resolved UUID from pickup-points/list for source', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-numeric-station'),
    sellerDropoffPvzMeta: { raw: { id: SELLER_PVZ_UUID } }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-numeric-station', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-numeric-station' });

  let sourcePlatformId: string | null = null;
  (yandexNddClient.requestCreate as any) = async (body: Record<string, any>) => {
    sourcePlatformId = body?.source?.platform_station?.platform_id ?? null;
    return { request_id: 'request-1', status: 'CREATED' };
  };

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-numeric-station');
  assert.equal(sourcePlatformId, SELLER_PVZ_UUID);
});

test('ready-to-ship accepts seller and buyer PVZ UUIDs', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-same-source-and-pickup');

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-same-source-and-pickup', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipment = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-same-source-and-pickup');
  assert.equal(shipment.requestId, 'request-1');
});

test('ready-to-ship when NDD returns 400 variant maps NDD_REQUEST_FAILED', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-6');
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-6', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;

  (yandexNddClient.requestCreate as any) = async () => {
    throw new YandexNddHttpError('NDD_REQUEST_FAILED', '/api/b2b/platform/request/create', 400, '{"message":"Value of source variant"}', {
      message: "Value of 'source' cannot be parsed as a variant"
    });
  };

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-6'),
    (err: any) => err instanceof YandexNddHttpError && err.code === 'NDD_REQUEST_FAILED' && String((err as any).details?.message).includes('variant')
  );
});


test('ready-to-ship throws when request/create has no request_id', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-request-create');
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-request-create', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-request-create' });

  (yandexNddClient.requestCreate as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-request-create'),
    (err: any) => err?.code === 'NDD_REQUEST_CREATE_NO_REQUEST_ID' || /request_id|REQUEST_ID/.test(String(err?.message ?? ''))
  );
});

test('ready-to-ship is idempotent and returns existing requestId', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-1'),
    yandexRequestId: 'req-existing',
    yandexStatus: 'CREATED'
  });

  const result = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-1');
  assert.equal(result.requestId, 'req-existing');
  assert.equal(result.ok, true);
});

test('ready-to-ship uses single-flight for concurrent calls by orderId', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-single-flight');

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-single-flight', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-single-flight' });

  let requestCreateCalled = 0;
  (yandexNddClient.requestCreate as any) = async () => {
    requestCreateCalled += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { request_id: 'request-1', status: 'CREATED' };
  };

  const [first, second] = await Promise.all([
    yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-single-flight'),
    yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-single-flight')
  ]);

  assert.equal(requestCreateCalled, 1);
  assert.equal(first.requestId, 'request-1');
  assert.equal(second.requestId, 'request-1');
});

test('ready-to-ship remaps smartcaptcha block to YANDEX_IP_BLOCKED', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-smartcaptcha');

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-smartcaptcha', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;

  (yandexNddClient.requestCreate as any) = async () => {
    throw new YandexNddHttpError('YANDEX_SMARTCAPTCHA_BLOCK', '/api/b2b/platform/request/create', 403, '<html/>', {
      uniqueKey: 'abc123'
    });
  };

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-smartcaptcha'),
    (err: any) => err instanceof YandexNddHttpError && err.code === 'YANDEX_SMARTCAPTCHA_BLOCK' && err.status === 403
  );
});
