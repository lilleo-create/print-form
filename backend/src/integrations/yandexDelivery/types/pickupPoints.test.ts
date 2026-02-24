import test from 'node:test';
import assert from 'node:assert/strict';
import { pickupPointsListRequestSchema } from './pickupPoints';

test('validates pickup points request payload', () => {
  const parsed = pickupPointsListRequestSchema.parse({
    geo_id: 213,
    is_post_office: false,
    latitude: { from: 55.4, to: 56.1 },
    longitude: { from: 37.2, to: 38.1 },
  });

  assert.equal(parsed.geo_id, 213);
});
