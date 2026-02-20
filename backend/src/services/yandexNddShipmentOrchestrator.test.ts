import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { yandexNddShipmentOrchestrator } from './yandexNddShipmentOrchestrator';
import { YandexNddHttpError, yandexNddClient } from './yandexNdd/YandexNddClient';

const sellerId = 'seller-1';

test.beforeEach(() => {
  delete process.env.YANDEX_NDD_MERCHANT_PLATFORM_STATION_ID;
  delete process.env.YANDEX_NDD_MERCHANT_ID;
  delete process.env.YANDEX_NDD_DEFAULT_PLATFORM_STATION_ID;
  delete process.env.YANDEX_NDD_PLATFORM_STATION_ID;
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffPlatformStationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924',
    dropoffStationMeta: null
  });
  (yandexNddClient.pickupPointsList as any) = async () => ({ points: [] });
  (yandexNddClient.offersCreate as any) = async () => ({ offers: [{ offer_id: 'offer-1' }] });
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });
  (yandexNddClient.requestCreate as any) = async () => ({ request_id: 'request-1' });
});

const mockPaidOrder = (id: string) => ({
  id,
  status: 'PAID',
  paidAt: new Date(),
  sellerDropoffPvzId: 'dropoff-1',
  sellerDropoffPvzMeta: { raw: { id: 'dropoff-1', operator_station_id: '10029618814' } },
  buyerPickupPvzId: '0193d98fb6fe76ce9ac1bbf9ea33d2f7',
  buyerPickupPvzMeta: { buyerPickupStationId: '10027909485', raw: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7', operator_station_id: '10027909485' } },
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
    buyerPickupPvzId: null
  });

  await assert.rejects(() => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-2'), /BUYER_PVZ_REQUIRED/);
});

test('ready-to-ship calls offers/create -> offers/confirm in order', async () => {
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
  (yandexNddClient.offersCreate as any) = async () => {
    callOrder.push('offersCreate');
    return { offers: [{ offer_id: 'offer-1' }] };
  };
  (yandexNddClient.offersConfirm as any) = async (body: Record<string, unknown>) => {
    callOrder.push('offersConfirm');
    assert.equal(body.offer_id, 'offer-1');
    return { request_id: 'request-1', status: 'CREATED' };
  };

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-seq');
  assert.deepEqual(callOrder, ['offersCreate', 'offersConfirm']);
});

test('ready-to-ship sends source.platform_station.platform_id and destination platform_id in offers/create', async () => {
  process.env.YANDEX_NDD_MERCHANT_ID = 'merchant-1';

  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-7');
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-7', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-7' });

  let offersPayload: any = null;

  (yandexNddClient.offersCreate as any) = async (body: Record<string, any>) => {
    offersPayload = body;
    return { offers: [{ offer_id: 'offer-1' }] };
  };
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-7');

  assert.equal(offersPayload?.source?.platform_station?.platform_id, 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924');
  assert.equal(offersPayload?.destination?.platform_station?.platform_id, '0193d98fb6fe76ce9ac1bbf9ea33d2f7');
  assert.equal(offersPayload?.last_mile_policy, 'self_pickup');
  assert.equal(offersPayload?.info?.merchant_id, 'merchant-1');
});





test('ready-to-ship does not fail when buyer platform station id is missing', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-no-buyer-station'),
    buyerPickupPvzMeta: { raw: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-no-buyer-station', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-no-buyer-station' });

  (yandexNddClient.pickupPointsList as any) = async () => ({ points: [{ id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' }] });
  (yandexNddClient.offersCreate as any) = async () => ({ offers: [{ offer_id: 'offer-1' }] });
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  const shipment = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-no-buyer-station');
  assert.equal(shipment.requestId, 'request-1');
});

test('ready-to-ship backfills buyer station id from pickup-points/list', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-backfill'),
    buyerPickupPvzId: '0193d98fb6fe76ce9ac1bbf9ea33d2f7',
    buyerPickupPvzMeta: { raw: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-backfill', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;

  const updates: any[] = [];
  (prisma.order.update as any) = async (payload: any) => {
    updates.push(payload);
    return { id: payload.where.id };
  };

  (yandexNddClient.pickupPointsList as any) = async () => ({
    points: [{ id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7', operator_station_id: '10027909485' }]
  });

  let offersCreateSelfPickupId = '';
  (yandexNddClient.offersCreate as any) = async (body: Record<string, any>) => {
    offersCreateSelfPickupId = body?.destination?.platform_station?.platform_id ?? '';
    return { offers: [{ offer_id: 'offer-backfill' }] };
  };
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-backfill', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-backfill');

  assert.equal(offersCreateSelfPickupId, '0193d98fb6fe76ce9ac1bbf9ea33d2f7');
  assert.ok(
    updates.some(
      (entry) =>
        entry?.data?.buyerPickupPvzMeta?.buyerPickupOperatorStationId === '10027909485' &&
        entry?.data?.buyerPickupPvzMeta?.raw?.buyerPickupOperatorStationId === '10027909485'
    )
  );
});

test('ready-to-ship does not fail when buyer station id is not digits', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-invalid-buyer-station'),
    buyerPickupPvzMeta: { buyerPickupStationId: 'abc123', raw: { id: 'pickup-1', operator_station_id: 'abc123' } }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-invalid-buyer-station', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipment = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-invalid-buyer-station');
  assert.ok(shipment.requestId);
});

test('ready-to-ship accepts seller profile station id as UUID', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-from-profile-meta-raw'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffPlatformStationId: 'ac17e5dd-0001-4111-8111-111111111111',
    dropoffStationMeta: { operator_station_id: '999000' }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-from-profile-meta-raw', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipment = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-from-profile-meta-raw');
  assert.ok(shipment.requestId);
});

test('ready-to-ship uses seller delivery profile station when order meta has no station id', async () => {
  delete process.env.YANDEX_NDD_MERCHANT_PLATFORM_STATION_ID;
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-from-profile'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffPlatformStationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924',
    dropoffStationMeta: { addressFull: 'Москва' }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-from-profile', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-from-profile' });

  let stationId: string | null = null;
  (yandexNddClient.offersCreate as any) = async (body: Record<string, any>) => {
    stationId = body?.source?.platform_station?.platform_id ?? null;
    return { offers: [{ offer_id: 'offer-1' }] };
  };
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-from-profile');
  assert.equal(stationId, 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924');
});

test('ready-to-ship trims seller profile dropoffPlatformStationId before station normalization', async () => {
  delete process.env.YANDEX_NDD_MERCHANT_PLATFORM_STATION_ID;
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-from-profile-trimmed'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffPlatformStationId: '   fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924   ',
    dropoffStationMeta: { addressFull: 'Москва' }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-from-profile-trimmed', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-from-profile-trimmed' });

  let stationId: string | null = null;
  (yandexNddClient.offersCreate as any) = async (body: Record<string, any>) => {
    stationId = body?.source?.platform_station?.platform_id ?? null;
    return { offers: [{ offer_id: 'offer-1' }] };
  };
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-from-profile-trimmed');
  assert.equal(stationId, 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924');
});

test('ready-to-ship ignores blank env override and uses profile station', async () => {
  process.env.YANDEX_NDD_MERCHANT_PLATFORM_STATION_ID = '   ';
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-blank-env'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffPlatformStationId: 'ac17e5dd-0001-4111-8111-111111111111',
    dropoffStationMeta: { addressFull: 'Москва' }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-blank-env', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-blank-env' });

  let stationId: string | null = null;
  (yandexNddClient.offersCreate as any) = async (body: Record<string, any>) => {
    stationId = body?.source?.platform_station?.platform_id ?? null;
    return { offers: [{ offer_id: 'offer-1' }] };
  };
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-blank-env');
  assert.equal(stationId, 'ac17e5dd-0001-4111-8111-111111111111');
});

test('ready-to-ship fails with SELLER_STATION_ID_REQUIRED when station id is missing', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.YANDEX_NDD_MERCHANT_PLATFORM_STATION_ID;
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => null;
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-no-station'),
    sellerDropoffPvzId: null,
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-no-station'),
    (err: any) => err?.code === 'SELLER_STATION_ID_REQUIRED'
  );
});


test('ready-to-ship uses env merchant station when profile station id is invalid', async () => {
  process.env.YANDEX_NDD_MERCHANT_PLATFORM_STATION_ID = 'ac17e5dd-0001-4111-8111-111111111111';
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-numeric-station'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffPlatformStationId: '10029618814',
    dropoffStationMeta: null
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-numeric-station', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-numeric-station' });

  let stationId: string | null = null;
  (yandexNddClient.offersCreate as any) = async (body: Record<string, any>) => {
    stationId = body?.source?.platform_station?.platform_id ?? null;
    return { offers: [{ offer_id: 'offer-1' }] };
  };
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-numeric-station');
  assert.equal(stationId, 'ac17e5dd-0001-4111-8111-111111111111');
});

test('ready-to-ship accepts profile station uuid without operator_station_id', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-same-source-and-pickup')
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffPlatformStationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924',
    dropoffStationMeta: null
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-same-source-and-pickup', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipment = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-same-source-and-pickup');
  assert.equal(shipment.requestId, 'request-1');
});

test('ready-to-ship when NDD returns 400 variant maps NDD_OFFER_CREATE_FAILED', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-6');
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-6', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;

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
    new Map([['order-request-create', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  let savedShipment: Record<string, unknown> | null = null;
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => {
    savedShipment = payload;
    return { id: 'shipment-1', ...payload };
  };
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-request-create' });

  (yandexNddClient.offersCreate as any) = async () => ({ offers: [{ offer_id: 'offer-1' }] });
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
    new Map([['order-1', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => ({ id: 'ship-existing', requestId: 'req-existing' });

  let offersCreateCalled = 0;
  (yandexNddClient.offersCreate as any) = async () => {
    offersCreateCalled += 1;
    return { offers: [{ offer_id: 'offer-1' }] };
  };

  const result = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-1');
  assert.equal(result.id, 'ship-existing');
  assert.equal(offersCreateCalled, 0);
});

test('ready-to-ship uses single-flight for concurrent calls by orderId', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-single-flight');

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-single-flight', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-single-flight' });

  let offersCreateCalled = 0;
  (yandexNddClient.offersCreate as any) = async () => {
    offersCreateCalled += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { offers: [{ offer_id: 'offer-1' }] };
  };
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  const [first, second] = await Promise.all([
    yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-single-flight'),
    yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-single-flight')
  ]);

  assert.equal(offersCreateCalled, 1);
  assert.equal(first.requestId, 'request-1');
  assert.equal(second.requestId, 'request-1');
});

test('ready-to-ship remaps smartcaptcha block to YANDEX_IP_BLOCKED', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-smartcaptcha');

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-smartcaptcha', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;

  (yandexNddClient.offersCreate as any) = async () => {
    throw new YandexNddHttpError('YANDEX_SMARTCAPTCHA_BLOCK', '/api/b2b/platform/offers/create', 403, '<html/>', {
      uniqueKey: 'abc123'
    });
  };

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-smartcaptcha'),
    (err: any) => err instanceof YandexNddHttpError && err.code === 'YANDEX_IP_BLOCKED' && err.status === 403
  );
});
