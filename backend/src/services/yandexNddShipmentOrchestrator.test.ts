import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { yandexNddShipmentOrchestrator } from './yandexNddShipmentOrchestrator';

const sellerId = 'seller-1';

test('ready-to-ship passes validation for pickup when normalized ids are set', async () => {
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
  (prisma.$queryRawUnsafe as any) = async () => [
    { order_id: 'order-1', delivery_payload: { deliveryMethod: 'PICKUP_POINT', pickupPoint: { id: 'pickup-1' } } }
  ];
  (prisma.$executeRawUnsafe as any) = async () => 1;

  (prisma.order.update as any) = async () => ({});

  const shipmentModule = await import('./shipmentService');
  (shipmentModule.shipmentService.getByOrderId as any) = async () => null;
  (shipmentModule.shipmentService.upsertForOrder as any) = async () => ({ id: 'ship-1', requestId: 'req-1' });
  (shipmentModule.shipmentService.pushHistory as any) = async () => ({});

  const clientModule = await import('./yandexNdd/YandexNddClient');
  (clientModule.yandexNddClient.offersCreate as any) = async () => ({ offers: [{ id: 'offer-1', price: { amount: 1 } }] });
  (clientModule.yandexNddClient.offersConfirm as any) = async () => ({});
  (clientModule.yandexNddClient.requestCreate as any) = async () => ({ request_id: 'req-1', status: 'CREATED' });

  const result = await yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-1');
  assert.equal(result.requestId, 'req-1');
});

test('ready-to-ship fails with SELLER_DROPOFF_REQUIRED', async () => {
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

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-2'),
    /SELLER_DROPOFF_REQUIRED/
  );
});

test('ready-to-ship fails with DELIVERY_DESTINATION_REQUIRED', async () => {
  (prisma.order.findFirst as any) = async () => ({
    id: 'order-3',
    status: 'PAID',
    paidAt: new Date(),
    sellerDropoffPvzId: 'dropoff-1',
    buyerPickupPvzId: null,
    shippingAddressId: null,
    contact: null,
    buyer: { name: 'Buyer', phone: '+7999' }
  });

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-3'),
    /DELIVERY_DESTINATION_REQUIRED/
  );
});

test('ready-to-ship fails with PAYMENT_REQUIRED when unpaid', async () => {
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

  await assert.rejects(
    () => yandexNddShipmentOrchestrator.readyToShip(sellerId, 'order-4'),
    /PAYMENT_REQUIRED/
  );
});
