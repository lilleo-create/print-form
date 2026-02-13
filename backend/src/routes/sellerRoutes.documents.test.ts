import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { sellerRoutes } from './sellerRoutes';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/seller', sellerRoutes);
  return app;
};

const tokenFor = (userId: string) => jwt.sign({ userId, role: 'SELLER', scope: 'access' }, env.jwtSecret);

const mockAuth = () => {
  (prisma.user.findUnique as any) = async () => ({ role: 'SELLER' });
  (prisma.sellerProfile.findUnique as any) = async () => ({ id: 'sp-1' });
};

const mockOrder = (orderId: string) => ({
  id: orderId,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  total: 1500,
  currency: 'RUB',
  recipientName: 'Иван Иванов',
  recipientPhone: '+79990000000',
  recipientEmail: 'ivan@test.dev',
  packagesCount: 1,
  orderLabels: [{ packageNo: 1, code: 'PF-ABC-1' }],
  buyerPickupPvzMeta: { addressFull: 'ПВЗ покупателя' },
  sellerDropoffPvzMeta: { addressFull: 'ПВЗ продавца' },
  items: [{ quantity: 1, priceAtPurchase: 1500, product: { title: 'Товар' } }]
});

test('seller documents endpoints return application/pdf and 200 for own order', async () => {
  mockAuth();
  (prisma.order.findFirst as any) = async ({ where }: any) => {
    if (where.id === 'order-own') return mockOrder('order-own');
    return null;
  };

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-1')}`;

  const packing = await request(app).get('/seller/orders/order-own/documents/packing-slip.pdf').set('Authorization', auth);
  const labels = await request(app).get('/seller/orders/order-own/documents/labels.pdf').set('Authorization', auth);
  const act = await request(app).get('/seller/orders/order-own/documents/handover-act.pdf').set('Authorization', auth);

  assert.equal(packing.status, 200);
  assert.equal(labels.status, 200);
  assert.equal(act.status, 200);
  assert.match(packing.headers['content-type'] ?? '', /application\/pdf/);
  assert.match(labels.headers['content-type'] ?? '', /application\/pdf/);
  assert.match(act.headers['content-type'] ?? '', /application\/pdf/);
});

test('seller can access documents only for own orders', async () => {
  mockAuth();
  (prisma.order.findFirst as any) = async ({ where }: any) => {
    if (where.id === 'order-own') return mockOrder('order-own');
    return null;
  };

  const app = buildApp();
  const auth = `Bearer ${tokenFor('seller-1')}`;

  const denied = await request(app)
    .get('/seller/orders/order-other/documents/packing-slip.pdf')
    .set('Authorization', auth);

  assert.equal(denied.status, 404);
});
