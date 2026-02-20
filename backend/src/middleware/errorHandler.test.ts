import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from './errorHandler';
import { YandexNddHttpError } from '../services/yandexNdd/YandexNddClient';

const makeRes = () => {
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

  return { res, get: () => ({ statusCode, payload }) };
};

test('ORDER_NOT_PAID maps to 409', () => {
  const ctx = makeRes();
  errorHandler(new Error('ORDER_NOT_PAID'), {} as any, ctx.res, (() => {}) as any);
  assert.equal(ctx.get().statusCode, 409);
  assert.deepEqual(ctx.get().payload, { error: { code: 'ORDER_NOT_PAID' } });
});

test('YandexNddHttpError 401 maps to NDD_UNAUTHORIZED', () => {
  const ctx = makeRes();
  const error = new YandexNddHttpError('NDD_REQUEST_FAILED', '/api/b2b/platform/request/create', 401, '{}', { message: 'Unauthorized' });
  errorHandler(error, {} as any, ctx.res, (() => {}) as any);
  assert.equal(ctx.get().statusCode, 401);
  assert.deepEqual(ctx.get().payload, {
    error: {
      code: 'NDD_UNAUTHORIZED',
      message: 'NDD request was rejected with Unauthorized.',
      details: { message: 'Unauthorized' }
    }
  });
});

test('YandexNddHttpError 403 no_permissions maps to NDD_NO_PERMISSIONS', () => {
  const ctx = makeRes();
  const error = new YandexNddHttpError('NDD_REQUEST_FAILED', '/api/b2b/platform/request/create', 403, '{}', { code: 'no_permissions' });
  errorHandler(error, {} as any, ctx.res, (() => {}) as any);
  assert.equal(ctx.get().statusCode, 403);
  assert.deepEqual(ctx.get().payload, { error: { code: 'NDD_NO_PERMISSIONS', details: { code: 'no_permissions' } } });
});

test('Yandex SmartCaptcha block maps to YANDEX_IP_BLOCKED and 503', () => {
  const ctx = makeRes();
  const error = new YandexNddHttpError('YANDEX_SMARTCAPTCHA_BLOCK', '/api/b2b/platform/offers/info', 403, '<html>', {
    uniqueKey: 'abc123'
  });
  errorHandler(error, {} as any, ctx.res, (() => {}) as any);
  assert.equal(ctx.get().statusCode, 503);
  assert.deepEqual(ctx.get().payload, { error: { code: 'YANDEX_IP_BLOCKED', details: { uniqueKey: 'abc123' } } });
});
