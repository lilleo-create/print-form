import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { yandexNddShipmentOrchestrator } from './yandexNddShipmentOrchestrator';
import { yandexNddClient } from './yandexNdd/YandexNddClient';

const setupBaseMocks = async (orderId: string) => {
  (prisma.order.findFirst as any) = async () => ({
    id: orderId,
    status: 'PAID',
    paidAt: new Date(),
    sellerDropoffPvzId: 'pvz-dropoff',
    sellerDropoffPvzMeta: {},
    buyerPickupPvzId: '0193d98fb6fe76ce9ac1bbf9ea33d2f7',
    buyerPickupPvzMeta: { raw: { id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7' } },
    recipientName: 'Иван Иванов',
    recipientPhone: '+79991112233',
    contact: { phone: '+79991112233' },
    buyer: { name: 'Buyer Name', phone: '+79991112233' },
    items: [{ quantity: 1, priceAtPurchase: 100, product: { title: 'T', sku: 'SKU', weightGrossG: 100, dxCm: 10, dyCm: 10, dzCm: 10 }, variant: null }]
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffPvzId: 'pvz-dropoff',
    dropoffOperatorStationId: '100000001',
    dropoffPlatformStationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924',
    dropoffStationMeta: null
  });
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () => new Map([[orderId, { deliveryMethod: 'PICKUP_POINT' }]]);
  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: orderId });
};

test('uses platform station for source and pvzId for destination in offers/create', async () => {
  await setupBaseMocks('order-ids-ok');

  (yandexNddClient.pickupPointsList as any) = async () => ({
    points: [{ id: '0193d98fb6fe76ce9ac1bbf9ea33d2f7', station_id: '300000001', operator_station_id: '100000002' }]
  });

  let createArgs: string[] = [];
  (yandexNddClient.offersCreate as any) = async (body: Record<string, any>) => {
    createArgs = [
      body?.source?.platform_station?.platform_id ?? '',
      body?.destination?.platform_station?.platform_id ?? ''
    ];
    return { offers: [{ offer_id: 'offer-1' }] };
  };
  (yandexNddClient.offersConfirm as any) = async () => ({ request_id: 'request-1', status: 'CREATED' });

  await yandexNddShipmentOrchestrator.readyToShip('seller-1', 'order-ids-ok');
  assert.deepEqual(createArgs, ['fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924', '0193d98fb6fe76ce9ac1bbf9ea33d2f7']);
});

test('throws SELLER_STATION_ID_REQUIRED when platform station is missing', async () => {
  await setupBaseMocks('order-no-seller-station');
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffPvzId: 'pvz-dropoff',
    dropoffOperatorStationId: '100000001',
    dropoffPlatformStationId: null,
    dropoffStationMeta: null
  });

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip('seller-1', 'order-no-seller-station'),
    (err: any) => err?.code === 'SELLER_STATION_ID_REQUIRED'
  );
});

test('throws VALIDATION_ERROR when buyer pvz id is digits (operator id passed as pvz)', async () => {
  await setupBaseMocks('order-bad-pvz');
  (prisma.order.findFirst as any) = async () => ({
    id: 'order-bad-pvz',
    status: 'PAID',
    paidAt: new Date(),
    sellerDropoffPvzId: 'pvz-dropoff',
    sellerDropoffPvzMeta: {},
    buyerPickupPvzId: '10027909485',
    buyerPickupPvzMeta: { raw: { id: '10027909485' } },
    recipientName: 'Иван Иванов',
    recipientPhone: '+79991112233',
    contact: { phone: '+79991112233' },
    buyer: { name: 'Buyer Name', phone: '+79991112233' },
    items: [{ quantity: 1, priceAtPurchase: 100, product: { title: 'T', sku: 'SKU', weightGrossG: 100, dxCm: 10, dyCm: 10, dzCm: 10 }, variant: null }]
  });

  (yandexNddClient.pickupPointsList as any) = async () => ({ points: [{ id: '10027909485', station_id: '300000001' }] });
  await assert.rejects(() => yandexNddShipmentOrchestrator.readyToShip('seller-1', 'order-bad-pvz'), /buyerPickupPvzId/);
});
