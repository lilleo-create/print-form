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

test('sets strict Authorization header as Bearer <token> when env token is stored without Bearer prefix', async () => {
  process.env.YANDEX_NDD_TOKEN = 'abcdefghijklmnop';
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



test('normalizes token when env value already contains Bearer prefix', async () => {
  process.env.YANDEX_NDD_TOKEN = 'Bearer prefixed-token';
  let capturedHeaders: Headers | undefined;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedHeaders = new Headers(init?.headers ?? {});
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const client = new YandexNddClient();
  await client.offersCreate({});

  assert.ok(capturedHeaders);
  assert.equal(capturedHeaders?.get('Authorization'), 'Bearer prefixed-token');
});

test('offersInfo sends expected query params', async () => {
  process.env.YANDEX_NDD_TOKEN = 'token';
  let url = '';

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    url = String(input);
    return new Response(JSON.stringify({ intervals: [] }), { status: 200 });
  }) as typeof fetch;

  const client = new YandexNddClient();
  await client.offersInfo('station-1', 'pvz-1');

  assert.match(url, /offers\/info\?/);
  assert.match(url, /station_id=station-1/);
  assert.match(url, /self_pickup_id=pvz-1/);
  assert.match(url, /last_mile_policy=time_interval/);
  assert.match(url, /send_unix=true/);
});

test('logs token preview/length and Bearer prefix flag on failed responses', async () => {
  process.env.YANDEX_NDD_TOKEN = 'abcdefghij12345';
  process.env.NODE_ENV = 'test';

  const consoleInfoSpy = test.mock.method(console, 'info');
  const consoleErrorSpy = test.mock.method(console, 'error');

  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 401 });
  }) as typeof fetch;

  const client = new YandexNddClient();

  await assert.rejects(() => client.offersCreate({}), /NDD_OFFER_CREATE_FAILED/);

  const [, authPayload] = consoleInfoSpy.mock.calls.find((call) => call.arguments[0] === '[YANDEX_NDD][auth]')?.arguments ?? [];
  assert.equal(authPayload.tokenPreview, 'abcdefghij');
  assert.equal(authPayload.tokenLength, 15);
  assert.equal(authPayload.rawHadBearerPrefix, false);

  const [, payload] = consoleErrorSpy.mock.calls[0]?.arguments ?? [];
  assert.equal(payload.tokenPreview, 'abcdefghij');
  assert.equal(payload.tokenLength, 15);
  assert.equal(payload.rawHadBearerPrefix, false);
});
