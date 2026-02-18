import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { sellerRoutes } from './sellerRoutes';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { yandexNddClient } from '../services/yandexNdd/YandexNddClient';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/seller', sellerRoutes);
  return app;
};

const tokenFor = (userId: string, role: 'SELLER' | 'BUYER' = 'SELLER') =>
  jwt.sign({ userId, role, scope: 'access' }, env.jwtSecret);

test('creates default seller delivery profile on onboarding when profile is absent', async () => {
  let upsertPayload: unknown = null;

  (prisma.user.findUnique as unknown as (...args: unknown[]) => unknown) = async (...args: unknown[]) => {
    const firstArg = (args[0] ?? null) as { select?: Record<string, boolean> } | null;
    if (firstArg?.select?.role) {
      return { role: 'BUYER' };
    }
    return { phoneVerifiedAt: new Date('2026-02-01T00:00:00.000Z'), phone: '+79991234567' };
  };
  (prisma.user.update as unknown as (...args: unknown[]) => unknown) = async () => ({
    id: 'seller-1',
    name: 'Seller',
    email: 'seller@test.dev',
    phone: '+79991234567',
    role: 'SELLER'
  });
  (prisma.sellerDeliveryProfile.upsert as unknown as (...args: unknown[]) => unknown) = async (args: unknown) => {
    upsertPayload = args;
    return { sellerId: 'seller-1', dropoffStationId: '' };
  };

  const app = buildApp();
  const response = await request(app)
    .post('/seller/onboarding')
    .set('Authorization', `Bearer ${tokenFor('seller-1', 'BUYER')}`)
    .send({
      name: 'Seller',
      phone: '+79991234567',
      status: 'ИП',
      storeName: 'Store',
      city: 'Moscow',
      referenceCategory: 'Category',
      catalogPosition: 'Position'
    });

  assert.equal(response.status, 200);
  assert.deepEqual(upsertPayload, {
    where: { sellerId: 'seller-1' },
    create: { sellerId: 'seller-1' },
    update: {}
  });
});

test('dropoff-pvz stores pvzId in settings and operator_station_id as source_platform_station', async () => {
  const sellerDeliveryUpserts: unknown[] = [];

  (prisma.user.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ role: 'SELLER' });
  (prisma.sellerProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ id: 'sp-1' });
  (prisma.sellerSettings.findUnique as unknown as (...args: unknown[]) => unknown) = async () => null;
  (prisma.sellerSettings.upsert as unknown as (...args: unknown[]) => unknown) = async (args: unknown) => ({
    sellerId: 'seller-2',
    ...(args as { create: Record<string, unknown> }).create
  });
  (prisma.sellerDeliveryProfile.upsert as unknown as (...args: unknown[]) => unknown) = async (args: unknown) => {
    sellerDeliveryUpserts.push(args);
    return { sellerId: 'seller-2', dropoffStationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924' };
  };

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  const dropoffResponse = await request(app)
    .put('/seller/settings/dropoff-pvz')
    .set('Authorization', auth)
    .send({
      dropoffPvz: {
        provider: 'YANDEX_NDD',
        pvzId: 'pvz-widget-id',
        raw: { id: 'pvz-widget-id', operator_station_id: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924' },
        addressFull: 'Москва, ул. Пример, 1'
      }
    });

  assert.equal(dropoffResponse.status, 200);
  assert.equal(dropoffResponse.body?.data?.defaultDropoffPvzId, 'pvz-widget-id');
  assert.equal((sellerDeliveryUpserts[0] as any).update.dropoffStationId, 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924');
  assert.equal((sellerDeliveryUpserts[0] as any).update.dropoffStationMeta.source_platform_station, 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924');
  assert.equal((sellerDeliveryUpserts[0] as any).update.dropoffStationMeta.pvz_id, 'pvz-widget-id');
});




test('dropoff-pvz derives source_platform_station from pvzId when operator_station_id is missing', async () => {
  const sellerDeliveryUpserts: unknown[] = [];

  (prisma.user.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ role: 'SELLER' });
  (prisma.sellerProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ id: 'sp-1' });
  (prisma.sellerSettings.upsert as unknown as (...args: unknown[]) => unknown) = async (args: unknown) => ({
    sellerId: 'seller-2',
    ...(args as { create: Record<string, unknown> }).create
  });
  (prisma.sellerDeliveryProfile.upsert as unknown as (...args: unknown[]) => unknown) = async (args: unknown) => {
    sellerDeliveryUpserts.push(args);
    return { sellerId: 'seller-2', dropoffStationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924' };
  };

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  const response = await request(app)
    .put('/seller/settings/dropoff-pvz')
    .set('Authorization', auth)
    .send({
      dropoffPvz: {
        provider: 'YANDEX_NDD',
        pvzId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924',
        raw: { stationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924' }
      }
    });

  assert.equal(response.status, 200);
  assert.equal((sellerDeliveryUpserts[0] as any).update.dropoffStationId, 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924');
  assert.equal((sellerDeliveryUpserts[0] as any).update.dropoffStationMeta.source_platform_station, 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924');
});



test('dropoff-pvz returns DROP_OFF_PVZ_ID_REQUIRED when pvzId is empty', async () => {
  (prisma.user.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ role: 'SELLER' });
  (prisma.sellerProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ id: 'sp-1' });

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  const response = await request(app)
    .put('/seller/settings/dropoff-pvz')
    .set('Authorization', auth)
    .send({
      dropoffPvz: {
        provider: 'YANDEX_NDD',
        pvzId: '   ',
        raw: { id: 'pvz-widget-id' }
      }
    });

  assert.equal(response.status, 400);
  assert.equal(response.body?.error?.code, 'DROP_OFF_PVZ_ID_REQUIRED');
});

test('dropoff-pvz returns DROP_OFF_NOT_AVAILABLE when point is unavailable for dropoff', async () => {
  (prisma.user.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ role: 'SELLER' });
  (prisma.sellerProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ id: 'sp-1' });

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  const dropoffResponse = await request(app)
    .put('/seller/settings/dropoff-pvz')
    .set('Authorization', auth)
    .send({
      dropoffPvz: {
        provider: 'YANDEX_NDD',
        pvzId: 'pvz-widget-id',
        raw: { id: 'pvz-widget-id', stationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924', available_for_dropoff: false },
        addressFull: 'Москва, ул. Пример, 1'
      }
    });

  assert.equal(dropoffResponse.status, 400);
  assert.equal(dropoffResponse.body?.error?.code, 'DROP_OFF_NOT_AVAILABLE');
});
test('settings returns both source platform station and dropoff pvz separately', async () => {
  (prisma.user.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ role: 'SELLER' });
  (prisma.sellerProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ id: 'sp-1' });
  (prisma.sellerDeliveryProfile.upsert as unknown as (...args: unknown[]) => unknown) = async () => ({ sellerId: 'seller-2' });
  (prisma.sellerSettings.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({
    sellerId: 'seller-2',
    defaultDropoffPvzId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924',
    defaultDropoffPvzMeta: { addressFull: 'Москва, ул. Пушкина', raw: { stationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({
    sellerId: 'seller-2',
    dropoffStationId: '10035218565',
    dropoffStationMeta: { source: 'manual_input' }
  });

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  const response = await request(app)
    .get('/seller/settings')
    .set('Authorization', auth);

  assert.equal(response.status, 200);
  assert.equal(response.body?.data?.dropoffStationId, '10035218565');
  assert.equal(response.body?.data?.defaultDropoffPvzId, 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924');
  assert.equal(response.body?.data?.dropoffPvz?.pvzId, 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924');
});


test('dropoff-stations returns normalized warehouse points by geo id', async () => {
  (prisma.user.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ role: 'SELLER' });
  (prisma.sellerProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ id: 'sp-1' });
  (yandexNddClient.pickupPointsList as unknown as (...args: unknown[]) => unknown) = async () => ({
    points: [
      {
        id: 'warehouse-id-1',
        operator_station_id: 'operator-station-1',
        name: 'Склад 1',
        address: { full_address: 'Москва, Примерная, 1' },
        position: { latitude: 55.75, longitude: 37.61 },
        max_weight_gross: 25000
      }
    ]
  });

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  const response = await request(app)
    .get('/seller/ndd/dropoff-stations?geoId=213&limit=10')
    .set('Authorization', auth);

  assert.equal(response.status, 200);
  assert.equal(response.body?.points?.length, 1);
  assert.equal(response.body?.points?.[0]?.id, 'warehouse-id-1');
  assert.equal(response.body?.points?.[0]?.addressFull, 'Москва, Примерная, 1');
});

test('dev endpoint sets test station for seller delivery profile', async () => {
  const sellerDeliveryUpserts: unknown[] = [];

  process.env.YANDEX_NDD_DEV_OPERATOR_STATION_ID = '10035218565';

  (prisma.user.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ role: 'SELLER' });
  (prisma.sellerProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ id: 'sp-1' });
  (prisma.sellerDeliveryProfile.upsert as unknown as (...args: unknown[]) => unknown) = async (args: unknown) => {
    sellerDeliveryUpserts.push(args);
    return { sellerId: 'seller-2', dropoffStationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924' };
  };

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  const response = await request(app)
    .post('/seller/settings/dropoff-pvz/test-station')
    .set('Authorization', auth)
    .send({});

  assert.equal(response.status, 200);
  assert.equal((sellerDeliveryUpserts[0] as any).update.dropoffStationId, '10035218565');
});

test('manual source_platform_station is validated and saved to seller delivery profile', async () => {
  const sellerDeliveryUpserts: unknown[] = [];

  (prisma.user.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ role: 'SELLER' });
  (prisma.sellerProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ id: 'sp-1' });
  (prisma.sellerDeliveryProfile.upsert as unknown as (...args: unknown[]) => unknown) = async (args: unknown) => {
    sellerDeliveryUpserts.push(args);
    return { sellerId: 'seller-2', dropoffStationId: '123456' };
  };
  (yandexNddClient.offersInfo as unknown as (...args: unknown[]) => unknown) = async () => ({ intervals: [{ from: 1, to: 2 }] });

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  const response = await request(app)
    .put('/seller/settings/source-platform-station')
    .set('Authorization', auth)
    .send({ source_platform_station: '123456' });

  assert.equal(response.status, 200);
  assert.equal((sellerDeliveryUpserts[0] as any).update.dropoffStationId, '123456');
});

test('manual source_platform_station returns validation error for invalid station id', async () => {
  (prisma.user.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ role: 'SELLER' });
  (prisma.sellerProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ id: 'sp-1' });

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  const response = await request(app)
    .put('/seller/settings/source-platform-station')
    .set('Authorization', auth)
    .send({ source_platform_station: 'pvz-id-from-widget' });

  assert.equal(response.status, 400);
  assert.equal(response.body?.error?.code, 'SELLER_STATION_ID_INVALID');
});
