import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { yandexNddShipmentOrchestrator } from './yandexNddShipmentOrchestrator';
import { YandexNddHttpError, yandexNddClient } from './yandexNdd/YandexNddClient';

const sellerId = 'seller-1';

test.beforeEach(() => {
  delete process.env.YANDEX_NDD_OPERATOR_STATION_ID;
  delete process.env.YANDEX_NDD_DEFAULT_PLATFORM_STATION_ID;
  delete process.env.YANDEX_NDD_PLATFORM_STATION_ID;
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffStationId: '10029618814',
    dropoffStationMeta: null
  });
  (yandexNddClient.pickupPointsList as any) = async () => ({ points: [] });
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

test('ready-to-ship calls offers/info -> offers/create -> offers/confirm in order', async () => {
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
  process.env.YANDEX_NDD_OPERATOR_STATION_ID = '10029618814';

  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-7');
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-7', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

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

  assert.equal(offersPayload?.station_id, '10029618814');
  assert.equal(offersPayload?.self_pickup_id, '0193d98fb6fe76ce9ac1bbf9ea33d2f7');
  assert.deepEqual(offersPayload?.interval_utc, interval);
  assert.equal(offersPayload?.last_mile_policy, 'time_interval');
});





test('ready-to-ship fails with BUYER_STATION_ID_REQUIRED when buyer station id is missing', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-no-buyer-station'),
    buyerPickupPvzMeta: { raw: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }
  });

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-no-buyer-station'),
    /BUYER_STATION_ID_REQUIRED/
  );
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

  let offersInfoSelfPickupId = '';
  (yandexNddClient.offersInfo as any) = async (_stationId: string, selfPickupId: string) => {
    offersInfoSelfPickupId = selfPickupId;
    return { intervals_utc: [{ from: 1700001000, to: 1700004600 }] };
  };
  (yandexNddClient.offersCreate as any) = async () => ({ offer_id: 'offer-backfill' });
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-backfill', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-backfill');

  assert.equal(offersInfoSelfPickupId, '10027909485');
  assert.ok(
    updates.some(
      (entry) =>
        entry?.data?.buyerPickupPvzMeta?.buyerPickupStationId === '10027909485' &&
        entry?.data?.buyerPickupPvzMeta?.raw?.buyerPickupStationId === '10027909485'
    )
  );
});

test('ready-to-ship fails with VALIDATION_ERROR when buyer station id is not digits', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-invalid-buyer-station'),
    buyerPickupPvzMeta: { buyerPickupStationId: 'abc123', raw: { id: 'pickup-1', operator_station_id: 'abc123' } }
  });

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-invalid-buyer-station'),
    /VALIDATION_ERROR/
  );
});

test('ready-to-ship uses meta.operator_station_id when profile station id is not numeric', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-from-profile-meta-raw'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffStationId: 'ac17e5dd-0001-4111-8111-111111111111',
    dropoffStationMeta: { operator_station_id: '999000' }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-from-profile-meta-raw', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-from-profile-meta-raw' });

  let stationId: string | null = null;
  (yandexNddClient.offersInfo as any) = async (src: string) => {
    stationId = src;
    return { intervals_utc: [{ from: 1, to: 2 }] };
  };
  (yandexNddClient.offersCreate as any) = async () => ({ offer_id: 'offer-1' });
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-from-profile-meta-raw');
  assert.equal(stationId, '999000');
});

test('ready-to-ship uses seller delivery profile station when order meta has no station id', async () => {
  delete process.env.YANDEX_NDD_OPERATOR_STATION_ID;
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-from-profile'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffStationId: '10029618814',
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
  (yandexNddClient.offersInfo as any) = async (src: string) => {
    stationId = src;
    return { intervals_utc: [{ from: 1, to: 2 }] };
  };
  (yandexNddClient.offersCreate as any) = async () => ({ offer_id: 'offer-1' });
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-from-profile');
  assert.equal(stationId, '10029618814');
});

test('ready-to-ship trims seller profile dropoffStationId before station normalization', async () => {
  delete process.env.YANDEX_NDD_OPERATOR_STATION_ID;
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-from-profile-trimmed'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffStationId: '   10029618814   ',
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
  (yandexNddClient.offersInfo as any) = async (src: string) => {
    stationId = src;
    return { intervals_utc: [{ from: 1, to: 2 }] };
  };
  (yandexNddClient.offersCreate as any) = async () => ({ offer_id: 'offer-1' });
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-from-profile-trimmed');
  assert.equal(stationId, '10029618814');
});

test('ready-to-ship ignores blank env override and uses profile station', async () => {
  process.env.YANDEX_NDD_OPERATOR_STATION_ID = '   ';
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-blank-env'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffStationId: '10035218565',
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
  (yandexNddClient.offersInfo as any) = async (src: string) => {
    stationId = src;
    return { intervals_utc: [{ from: 1, to: 2 }] };
  };
  (yandexNddClient.offersCreate as any) = async () => ({ offer_id: 'offer-1' });
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-blank-env');
  assert.equal(stationId, '10035218565');
});

test('ready-to-ship fails with SELLER_STATION_ID_REQUIRED when station id is missing', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.YANDEX_NDD_OPERATOR_STATION_ID;
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => null;
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-no-station'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });

  await assert.rejects(() => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-no-station'), /SELLER_STATION_ID_REQUIRED/);
});


test('ready-to-ship accepts numeric station id from seller profile', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-numeric-station'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffStationId: '10029618814',
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
  (yandexNddClient.offersInfo as any) = async (src: string) => {
    stationId = src;
    return { intervals_utc: [{ from: 1, to: 2 }] };
  };
  (yandexNddClient.offersCreate as any) = async () => ({ offer_id: 'offer-1' });
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-numeric-station');
  assert.equal(stationId, '10029618814');
});

test('ready-to-ship falls back to meta.operator_station_id when profile id is uuid', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-profile-station-uuid'),
    sellerDropoffPvzMeta: { raw: { id: 'dropoff-1' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffStationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924',
    dropoffStationMeta: { operator_station_id: '10034601583', addressFull: 'Москва' }
  });

  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-profile-station-uuid', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: 'order-profile-station-uuid' });

  let stationId: string | null = null;
  (yandexNddClient.offersInfo as any) = async (src: string) => {
    stationId = src;
    return { intervals_utc: [{ from: 1, to: 2 }] };
  };
  (yandexNddClient.offersCreate as any) = async () => ({ offer_id: 'offer-1' });
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-profile-station-uuid');
  assert.equal(stationId, '10034601583');
});



test('ready-to-ship fails with SELLER_STATION_ID_REQUIRED when profile station is uuid without operator_station_id', async () => {
  (prisma.order.findFirst as any) = async () => ({
    ...mockPaidOrder('order-same-source-and-pickup')
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffStationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924',
    dropoffStationMeta: null
  });

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-same-source-and-pickup'),
    /SELLER_STATION_ID_REQUIRED/
  );
});

test('ready-to-ship when NDD returns 400 variant maps NDD_OFFER_CREATE_FAILED', async () => {
  (prisma.order.findFirst as any) = async () => mockPaidOrder('order-6');
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () =>
    new Map([['order-6', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

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
    new Map([['order-1', { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } }]]);

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

  let offersInfoCalled = 0;
  (yandexNddClient.offersInfo as any) = async () => {
    offersInfoCalled += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { intervals_utc: [{ from: 1, to: 2 }] };
  };
  (yandexNddClient.offersCreate as any) = async () => ({ offer_id: 'offer-1' });
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  const [first, second] = await Promise.all([
    yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-single-flight'),
    yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-single-flight')
  ]);

  assert.equal(offersInfoCalled, 1);
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

  (yandexNddClient.offersInfo as any) = async () => {
    throw new YandexNddHttpError('YANDEX_SMARTCAPTCHA_BLOCK', '/api/b2b/platform/offers/info', 403, '<html/>', {
      uniqueKey: 'abc123'
    });
  };

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-smartcaptcha'),
    (err: any) => err instanceof YandexNddHttpError && err.code === 'YANDEX_IP_BLOCKED' && err.status === 403
  );
});
