import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { mapExternalStatusToInternal, normalizePvzProvider } from './shipmentService';

test('mapExternalStatusToInternal maps CDEK statuses', () => {
  assert.equal(mapExternalStatusToInternal('ACCEPTED'), 'READY_TO_SHIP');
  assert.equal(mapExternalStatusToInternal('IN_TRANSIT'), 'IN_TRANSIT');
  assert.equal(mapExternalStatusToInternal('DELIVERED'), 'DELIVERED');
  assert.equal(mapExternalStatusToInternal('INVALID'), 'CANCELLED');
});

test('normalizePvzProvider upgrades legacy provider to CDEK when pvz code matches', async () => {
  let updated = false;
  (prisma.order.update as any) = async ({ data }: any) => {
    updated = data?.buyerPickupPvzMeta?.provider === 'CDEK';
    return {};
  };

  const order = {
    id: 'o-1',
    carrier: 'CDEK',
    buyerPickupPvzId: 'MSK117',
    buyerPickupPvzMeta: { provider: 'LEGACY' }
  };

  const normalized = await normalizePvzProvider(order as any);

  assert.equal(updated, true);
  assert.equal((normalized as any).buyerPickupPvzMeta.provider, 'CDEK');
});
