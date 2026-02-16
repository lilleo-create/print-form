import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { sellerRoutes } from './sellerRoutes';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';

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
    create: { sellerId: 'seller-1', dropoffStationId: '' },
    update: {}
  });
});

test('returns OPERATOR_STATION_ID_MISSING when dropoff pvz has no operator station id', async () => {
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
    return { sellerId: 'seller-2', dropoffStationId: '' };
  };

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  await request(app).get('/seller/settings').set('Authorization', auth);

  const dropoffResponse = await request(app)
    .put('/seller/settings/dropoff-pvz')
    .set('Authorization', auth)
    .send({
      dropoffPvz: {
        provider: 'YANDEX_NDD',
        pvzId: 'f2330eea-c993-4f50-9def-1af3d940cf2b',
        raw: {
          id: 'f2330eea-c993-4f50-9def-1af3d940cf2b'
        },
        addressFull: 'Москва, ул. Пример, 1'
      }
    });

  assert.equal(dropoffResponse.status, 400);
  assert.equal(dropoffResponse.body?.error?.code, 'OPERATOR_STATION_ID_MISSING');
  assert.equal(sellerDeliveryUpserts.length, 1);
});

test('ensures seller delivery profile on settings and saves operator_station_id for dropoff pvz', async () => {
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
    return { sellerId: 'seller-2', dropoffStationId: '' };
  };

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-2')}`;

  const settingsResponse = await request(app)
    .get('/seller/settings')
    .set('Authorization', auth);

  assert.equal(settingsResponse.status, 200);
  assert.deepEqual(sellerDeliveryUpserts[0], {
    where: { sellerId: 'seller-2' },
    create: { sellerId: 'seller-2', dropoffStationId: '' },
    update: {}
  });

  const dropoffResponse = await request(app)
    .put('/seller/settings/dropoff-pvz')
    .set('Authorization', auth)
    .send({
      dropoffPvz: {
        provider: 'YANDEX_NDD',
        pvzId: 'fallback-pvz-id',
        raw: {
          id: 'pvz-detail-id',
          station: {
            id: 123456
          },
          operator_station_id: 123456
        },
        addressFull: 'Москва, ул. Пример, 1'
      }
    });

  assert.equal(dropoffResponse.status, 200);

  assert.deepEqual(sellerDeliveryUpserts[1], {
    where: { sellerId: 'seller-2' },
    create: {
      sellerId: 'seller-2',
      dropoffStationId: '123456',
      dropoffStationMeta: {
        provider: 'YANDEX_NDD',
        pvzId: 'pvz-detail-id',
        raw: {
          id: 'pvz-detail-id',
          station: {
            id: 123456
          },
          pvzId: 'pvz-detail-id',
          operator_station_id: '123456'
        },
        addressFull: 'Москва, ул. Пример, 1'
      }
    },
    update: {
      dropoffStationId: '123456',
      dropoffStationMeta: {
        provider: 'YANDEX_NDD',
        pvzId: 'pvz-detail-id',
        raw: {
          id: 'pvz-detail-id',
          station: {
            id: 123456
          },
          pvzId: 'pvz-detail-id',
          operator_station_id: '123456'
        },
        addressFull: 'Москва, ул. Пример, 1'
      }
    }
  });
});
