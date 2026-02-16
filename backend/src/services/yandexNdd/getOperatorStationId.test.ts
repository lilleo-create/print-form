import test from 'node:test';
import assert from 'node:assert/strict';
import { getOperatorStationId } from './getOperatorStationId';

test('returns operator_station_id from string', () => {
  assert.equal(getOperatorStationId({ operator_station_id: '10022023854' }), '10022023854');
});

test('returns operator_station_id from number', () => {
  assert.equal(getOperatorStationId({ operator_station_id: 10022023854 }), '10022023854');
});

test('returns station id from supported fallback fields', () => {
  assert.equal(getOperatorStationId({ operatorStationId: '10022023854' }), '10022023854');
  assert.equal(getOperatorStationId({ station_id: '10022023854' }), '10022023854');
  assert.equal(getOperatorStationId({ stationId: '10022023854' }), '10022023854');
  assert.equal(getOperatorStationId({ data: { operator_station_id: '10022023854' } }), '10022023854');
  assert.equal(getOperatorStationId({ pickup_point: { operator_station_id: '10022023854' } }), '10022023854');
  assert.equal(getOperatorStationId({ point: { operator_station_id: '10022023854' } }), '10022023854');
});

test('returns null for non-digit station ids', () => {
  assert.equal(getOperatorStationId({ operator_station_id: 'f2330eea-c993-4f50-9def-1af3d940cf2b' }), null);
  assert.equal(getOperatorStationId({ operator_station_id: 'station-123' }), null);
});

test('returns null for invalid payload', () => {
  assert.equal(getOperatorStationId({ id: 'pvz-1' }), null);
  assert.equal(getOperatorStationId(null), null);
});
