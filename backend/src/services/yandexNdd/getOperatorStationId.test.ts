import test from 'node:test';
import assert from 'node:assert/strict';
import { getOperatorStationId } from './getOperatorStationId';

test('returns operator_station_id from string', () => {
  assert.equal(getOperatorStationId({ operator_station_id: '10022023854' }), '10022023854');
});

test('returns operator_station_id from number', () => {
  assert.equal(getOperatorStationId({ operator_station_id: 10022023854 }), '10022023854');
});

test('returns null for invalid payload', () => {
  assert.equal(getOperatorStationId({ id: 'pvz-1' }), null);
  assert.equal(getOperatorStationId(null), null);
});
