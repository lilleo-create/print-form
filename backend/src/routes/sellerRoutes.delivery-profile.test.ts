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

test('dropoff-pvz updates seller settings and does not overwrite source platform station', async () => {
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
        raw: { id: 'pvz-widget-id', point_id: 'pvz-widget-id' },
        addressFull: 'Москва, ул. Пример, 1'
      }
    });

  assert.equal(dropoffResponse.status, 200);
  assert.equal(sellerDeliveryUpserts.length, 0);
  assert.equal(dropoffResponse.body?.data?.defaultDropoffPvzId, 'pvz-widget-id');
});

test('settings returns both source platform station and dropoff pvz separately', async () => {
  (prisma.user.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ role: 'SELLER' });
  (prisma.sellerProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ id: 'sp-1' });
  (prisma.sellerDeliveryProfile.upsert as unknown as (...args: unknown[]) => unknown) = async () => ({ sellerId: 'seller-2' });
  (prisma.sellerSettings.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({
    sellerId: 'seller-2',
    defaultDropoffPvzId: 'pvz-123',
    defaultDropoffPvzMeta: { addressFull: 'Москва, ул. Пушкина', raw: { id: 'pvz-123' } }
  });
  (prisma.sellerDeliveryProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({
    sellerId: 'seller-2',
    dropoffStationId: 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924',
    dropoffStationMeta: { source: 'manual_input' }
  });

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  const response = await request(app)
    .get('/seller/settings')
    .set('Authorization', auth);

  assert.equal(response.status, 200);
  assert.equal(response.body?.data?.dropoffStationId, 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924');
  assert.equal(response.body?.data?.defaultDropoffPvzId, 'pvz-123');
  assert.equal(response.body?.data?.dropoffPvz?.pvzId, 'pvz-123');
});

test('dev endpoint sets test station for seller delivery profile', async () => {
  const sellerDeliveryUpserts: unknown[] = [];

  (prisma.user.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ role: 'SELLER' });
  (prisma.sellerProfile.findUnique as unknown as (...args: unknown[]) => unknown) = async () => ({ id: 'sp-1' });
  (prisma.sellerDeliveryProfile.upsert as unknown as (...args: unknown[]) => unknown) = async (args: unknown) => {
    sellerDeliveryUpserts.push(args);
    return { sellerId: 'seller-2', dropoffStationId: '' };
  };

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  const response = await request(app)
    .post('/seller/settings/dropoff-pvz/test-station')
    .set('Authorization', auth)
    .send({});

  assert.equal(response.status, 200);
  assert.equal((sellerDeliveryUpserts[0] as any).update.dropoffStationId, 'fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924');
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
