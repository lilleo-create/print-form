import test from 'node:test';
import assert from 'node:assert/strict';
import { mapYandexError } from './errors';

test('maps documented duplicate operator request id error', () => {
  const mapped = mapYandexError({
    message: 'Request failed with status code 400',
    response: {
      status: 400,
      data: { message: 'There already was request with such code within this employer, request_id=1' },
    },
  });

  assert.equal(mapped.code, 'NDD_DUPLICATE_OPERATOR_REQUEST_ID');
  assert.equal(mapped.httpStatus, 400);
});

test('maps unauthorized', () => {
  const mapped = mapYandexError({ response: { status: 401, data: { message: 'Access denied' } } });
  assert.equal(mapped.code, 'NDD_ACCESS_DENIED');
});
