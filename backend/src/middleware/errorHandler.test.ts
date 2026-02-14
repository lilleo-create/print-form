import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from './errorHandler';
import { YandexNddHttpError } from '../services/yandexNdd/YandexNddClient';

test('PAYMENT_REQUIRED maps to 400', () => {
  let statusCode = 0;
  let payload: any = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    }
  } as any;

  errorHandler(new Error('PAYMENT_REQUIRED'), {} as any, res, (() => {}) as any);

  assert.equal(statusCode, 400);
  assert.deepEqual(payload, { error: { code: 'PAYMENT_REQUIRED' } });
});


test('YandexNddHttpError maps to structured upstream failure payload', () => {
  let statusCode = 0;
  let payload: any = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    }
  } as any;

  const error = new YandexNddHttpError(
    'NDD_OFFER_CREATE_FAILED',
    '/api/b2b/platform/offers/create',
    400,
    '{"code":"no_delivery_options"}',
    { code: 'no_delivery_options' }
  );

  errorHandler(error, {} as any, res, (() => {}) as any);

  assert.equal(statusCode, 502);
  assert.deepEqual(payload, {
    error: {
      code: 'NDD_OFFER_CREATE_FAILED',
      status: 400,
      details: { code: 'no_delivery_options' }
    }
  });
});
