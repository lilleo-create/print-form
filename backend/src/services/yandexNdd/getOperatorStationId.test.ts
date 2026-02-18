import test from 'node:test';
import assert from 'node:assert/strict';
import { getOperatorStationId, isDigitsStationId, normalizeDigitsStation, normalizeStationId, toStationId } from './getOperatorStationId';

test('returns operator_station_id from string', () => {
  assert.equal(getOperatorStationId({ operator_station_id: '10022023854' }), '10022023854');
});

test('returns null when operator_station_id is not string', () => {
  assert.equal(getOperatorStationId({ operator_station_id: 10022023854 }), null);
});

test('returns station id from supported operator fallback fields', () => {
  assert.equal(getOperatorStationId({ operatorStationId: '10022023854' }), '10022023854');
  assert.equal(getOperatorStationId({ data: { operator_station_id: '10022023854' } }), '10022023854');
  assert.equal(getOperatorStationId({ pickup_point: { operator_station_id: '10022023854' } }), '10022023854');
  assert.equal(getOperatorStationId({ point: { operator_station_id: '10022023854' } }), '10022023854');
  assert.equal(getOperatorStationId({ station_id: '10022023854' }), null);
  assert.equal(getOperatorStationId({ stationId: '10022023854' }), null);
  assert.equal(getOperatorStationId({ platformStationId: '10022023854' }), null);
});

test('always rejects uuid station id for operator station', () => {
  assert.equal(getOperatorStationId({ operator_station_id: 'f2330eea-c993-4f50-9def-1af3d940cf2b' }), null);
  assert.equal(getOperatorStationId({ platform_station_id: 'f2330eea-c993-4f50-9def-1af3d940cf2b' }), null);
});

test('digits helpers validate and normalize operator station ids', () => {
  assert.equal(isDigitsStationId('10035218565'), true);
  assert.equal(isDigitsStationId(' 10035218565 '), true);
  assert.equal(isDigitsStationId('019f2330eea'), false);
  assert.equal(normalizeDigitsStation(' 10035218565 '), '10035218565');
  assert.equal(normalizeDigitsStation('f2330eea-c993-4f50-9def-1af3d940cf2b'), null);
  assert.equal(toStationId('10035218565'), '10035218565');
  assert.equal(toStationId('f2330eea-c993-4f50-9def-1af3d940cf2b'), null);
  assert.equal(normalizeStationId('f2330eea-c993-4f50-9def-1af3d940cf2b', { allowUuid: false }), null);
});

test('returns digits station ids regardless of length and rejects non-digits', () => {
  assert.equal(getOperatorStationId({ operator_station_id: '12345' }), '12345');
  assert.equal(getOperatorStationId({ operator_station_id: '123456789012345678901' }), '123456789012345678901');
  assert.equal(getOperatorStationId({ operator_station_id: '123abc' }), null);
});

test('returns null for invalid payload', () => {
  assert.equal(getOperatorStationId({ id: 'pvz-1' }), null);
  assert.equal(getOperatorStationId(null), null);
});
