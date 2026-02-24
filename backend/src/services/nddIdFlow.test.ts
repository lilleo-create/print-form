import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { yandexNddShipmentOrchestrator } from './yandexNddShipmentOrchestrator';
import { yandexNddClient } from './yandexNdd/YandexNddClient';

const SELLER_PVZ_UUID = 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924';
const BUYER_PVZ_UUID = '0193d98f-b6fe-76ce-9ac1-bbf9ea33d2f7';

const setupBaseMocks = async (orderId: string) => {
  (prisma.order.findFirst as any) = async () => ({
    id: orderId,
    status: 'PAID',
    paidAt: new Date(),
    sellerDropoffPvzId: SELLER_PVZ_UUID,
    sellerDropoffPvzMeta: {},
    buyerPickupPvzId: BUYER_PVZ_UUID,
    buyerPickupPvzMeta: { raw: { id: BUYER_PVZ_UUID } },
    recipientName: 'Иван Иванов',
    recipientPhone: '+79991112233',
    contact: { phone: '+79991112233' },
    buyer: { name: 'Buyer Name', phone: '+79991112233' },
    items: [{ quantity: 1, priceAtPurchase: 100, product: { title: 'T', sku: 'SKU', weightGrossG: 100, dxCm: 10, dyCm: 10, dzCm: 10, sellerId: 'seller-1' }, variant: null }]
  });
  (prisma.sellerDeliveryProfile.findUnique as any) = async () => ({
    dropoffPvzId: SELLER_PVZ_UUID,
    dropoffOperatorStationId: '100000001',
    dropoffPlatformStationId: SELLER_PVZ_UUID,
    dropoffStationMeta: null
  });
  const deliveryServiceModule = await import('./orderDeliveryService');
  (deliveryServiceModule.orderDeliveryService.getByOrderIds as any) = async () => new Map([[orderId, { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: BUYER_PVZ_UUID } }]]);
  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async (payload: Record<string, unknown>) => ({ id: 'shipment-1', ...payload });
  (shipmentModule.shipmentService.pushHistory as any) = async () => undefined;
  (prisma.order.update as any) = async () => ({ id: orderId });
};

test('uses platform station for source and pvzId for destination in offers/create (no merchant)', async () => {
  await setupBaseMocks('order-ids-ok');

  (yandexNddClient.pickupPointsList as any) = async (body: { pickup_point_ids?: string[] }) => ({
    points: (body?.pickup_point_ids ?? []).map((id: string) => ({
      id,
      operator_station_id: id === SELLER_PVZ_UUID ? '100000001' : '100000002'
    }))
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
  assert.deepEqual(createArgs, [SELLER_PVZ_UUID, BUYER_PVZ_UUID]);
});

test('throws when seller dropoff PVZ is missing from pickup-points/list', async () => {
  await setupBaseMocks('order-no-seller-station');
  (prisma.order.findFirst as any) = async () => ({
    id: 'order-no-seller-station',
    status: 'PAID',
    paidAt: new Date(),
    sellerDropoffPvzId: '00000000-0000-0000-0000-000000000001',
    sellerDropoffPvzMeta: {},
    buyerPickupPvzId: BUYER_PVZ_UUID,
    buyerPickupPvzMeta: { raw: { id: BUYER_PVZ_UUID } },
    recipientName: 'Иван',
    recipientPhone: '+79991112233',
    contact: {},
    buyer: {},
    items: [{ quantity: 1, priceAtPurchase: 100, product: { title: 'T', sku: 'SKU', weightGrossG: 100, dxCm: 10, dyCm: 10, dzCm: 10, sellerId: 'seller-1' }, variant: null }]
  });
  (yandexNddClient.pickupPointsList as any) = async () => ({ points: [] });

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip('seller-1', 'order-no-seller-station'),
    (err: any) => err?.code === 'NDD_VALIDATION_ERROR' || /PVZ not found|not_found/.test(String(err?.message ?? ''))
  );
});

test('throws VALIDATION_ERROR when buyer pvz id is digits (operator id passed as pvz)', async () => {
  await setupBaseMocks('order-bad-pvz');
  (prisma.order.findFirst as any) = async () => ({
    id: 'order-bad-pvz',
    status: 'PAID',
    paidAt: new Date(),
    sellerDropoffPvzId: SELLER_PVZ_UUID,
    sellerDropoffPvzMeta: {},
    buyerPickupPvzId: '10027909485',
    buyerPickupPvzMeta: { raw: { id: '10027909485' } },
    recipientName: 'Иван Иванов',
    recipientPhone: '+79991112233',
    contact: { phone: '+79991112233' },
    buyer: { name: 'Buyer Name', phone: '+79991112233' },
    items: [{ quantity: 1, priceAtPurchase: 100, product: { title: 'T', sku: 'SKU', weightGrossG: 100, dxCm: 10, dyCm: 10, dzCm: 10, sellerId: 'seller-1' }, variant: null }]
  });

  await assert.rejects(() => yandexNddShipmentOrchestrator.readyToShip('seller-1', 'order-bad-pvz'), /buyerPickupPvzId|PVZ/);
});
