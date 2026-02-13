import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from './errorHandler';

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
