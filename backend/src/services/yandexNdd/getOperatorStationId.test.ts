import test from 'node:test';
import assert from 'node:assert/strict';
import { getOperatorStationId, normalizeStationId } from './getOperatorStationId';

test('returns operator_station_id from string', () => {
  assert.equal(getOperatorStationId({ operator_station_id: '10022023854' }), '10022023854');
});

test('returns null when operator_station_id is not string', () => {
  assert.equal(getOperatorStationId({ operator_station_id: 10022023854 }), null);
});

test('returns station id from supported fallback fields', () => {
  assert.equal(getOperatorStationId({ operatorStationId: '10022023854' }), '10022023854');
  assert.equal(getOperatorStationId({ station_id: '10022023854' }), '10022023854');
  assert.equal(getOperatorStationId({ stationId: '10022023854' }), '10022023854');
  assert.equal(getOperatorStationId({ data: { operator_station_id: '10022023854' } }), '10022023854');
  assert.equal(getOperatorStationId({ pickup_point: { operator_station_id: '10022023854' } }), '10022023854');
  assert.equal(getOperatorStationId({ point: { operator_station_id: '10022023854' } }), '10022023854');
});

test('accepts uuid station id by default', () => {
  assert.equal(getOperatorStationId({ operator_station_id: 'f2330eea-c993-4f50-9def-1af3d940cf2b' }), 'f2330eea-c993-4f50-9def-1af3d940cf2b');
});

test('can enforce production policy with digits-only', () => {
  assert.equal(getOperatorStationId({ operator_station_id: 'f2330eea-c993-4f50-9def-1af3d940cf2b' }, { allowUuid: false }), null);
  assert.equal(normalizeStationId('f2330eea-c993-4f50-9def-1af3d940cf2b', { allowUuid: false }), null);
  assert.equal(normalizeStationId('123456', { allowUuid: false }), '123456');
  assert.equal(getOperatorStationId({ operator_station_id: 'station-123' }, { allowUuid: false }), null);
});

test('returns null for too short or too long station ids', () => {
  assert.equal(getOperatorStationId({ operator_station_id: '12345' }), null);
  assert.equal(getOperatorStationId({ operator_station_id: '123456789012345678901' }), null);
});

test('returns null for invalid payload', () => {
  assert.equal(getOperatorStationId({ id: 'pvz-1' }), null);
  assert.equal(getOperatorStationId(null), null);
});
