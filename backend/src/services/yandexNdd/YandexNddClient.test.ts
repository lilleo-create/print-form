import test from 'node:test';
import assert from 'node:assert/strict';
import { YandexNddClient } from './YandexNddClient';

const originalFetch = globalThis.fetch;
const originalToken = process.env.YANDEX_NDD_TOKEN;
const originalNodeEnv = process.env.NODE_ENV;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) {
    delete process.env.YANDEX_NDD_TOKEN;
  } else {
    process.env.YANDEX_NDD_TOKEN = originalToken;
  }
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test('sets strict Authorization header as Bearer <token> even when env token already has Bearer prefix', async () => {
  process.env.YANDEX_NDD_TOKEN = 'Bearer abcdefghijklmnop';
  let capturedHeaders: Headers | undefined;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedHeaders = new Headers(init?.headers ?? {});
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const client = new YandexNddClient();
  await client.offersCreate({});

  assert.ok(capturedHeaders);
  assert.equal(capturedHeaders?.get('Authorization'), 'Bearer abcdefghijklmnop');
});

test('logs token preview/length and Bearer prefix flag on failed responses', async () => {
  process.env.YANDEX_NDD_TOKEN = 'Bearer abcdefghij12345';
  process.env.NODE_ENV = 'test';

  const consoleErrorSpy = test.mock.method(console, 'error');

  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 401 });
  }) as typeof fetch;

  const client = new YandexNddClient();

  await assert.rejects(() => client.offersCreate({}), /NDD_OFFER_CREATE_FAILED/);

  const [, payload] = consoleErrorSpy.mock.calls[0]?.arguments ?? [];
  assert.equal(payload.tokenPreview, 'abcdefghij');
  assert.equal(payload.tokenLength, 15);
  assert.equal(payload.hasBearerPrefix, true);
});
