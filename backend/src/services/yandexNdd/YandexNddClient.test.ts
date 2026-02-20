import test from 'node:test';
import assert from 'node:assert/strict';
import { YandexNddClient } from './YandexNddClient';

const originalFetch = globalThis.fetch;
const originalToken = process.env.YANDEX_NDD_TOKEN;
const originalNodeEnv = process.env.NODE_ENV;


const validOfferCreateBody = {
  source: { platform_station: { platform_id: '10029618814' } },
  destination: { platform_station: { platform_id: '11111111-2222-4333-8444-555555555555' } }
};

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
  await client.offersCreate(validOfferCreateBody);

  assert.ok(capturedHeaders);
  assert.equal(capturedHeaders?.get('Authorization'), 'Bearer abcdefghijklmnop');
  assert.equal(capturedHeaders?.get('Accept'), 'application/json');
  assert.equal(capturedHeaders?.get('User-Agent'), 'print-form-backend/1.0');
});



test('normalizes token when env value already contains Bearer prefix', async () => {
  process.env.YANDEX_NDD_TOKEN = 'Bearer prefixed-token';
  let capturedHeaders: Headers | undefined;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedHeaders = new Headers(init?.headers ?? {});
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const client = new YandexNddClient();
  await client.offersCreate(validOfferCreateBody);

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
  await client.offersInfo('10029618814', '11111111-2222-4333-8444-555555555555');

  assert.match(url, /offers\/info\?/);
  assert.match(url, /station_id=10029618814/);
  assert.match(url, /self_pickup_id=11111111-2222-4333-8444-555555555555/);
  assert.match(url, /last_mile_policy=self_pickup/);
  assert.match(url, /send_unix=true/);
});

test('offersInfo caches response for same key and does not duplicate HTTP calls', async () => {
  process.env.YANDEX_NDD_TOKEN = 'token';
  let callCount = 0;

  globalThis.fetch = (async () => {
    callCount += 1;
    return new Response(JSON.stringify({ intervals: [{ from: 1, to: 2 }] }), { status: 200 });
  }) as typeof fetch;

  const client = new YandexNddClient();
  const first = await client.offersInfo('10029618814', '11111111-2222-4333-8444-555555555555');
  const second = await client.offersInfo('10029618814', '11111111-2222-4333-8444-555555555555');

  assert.deepEqual(first, second);
  assert.equal(callCount, 1);
});

test('logs only token length on failed responses', async () => {
  process.env.YANDEX_NDD_TOKEN = 'abcdefghij12345';
  process.env.NODE_ENV = 'test';

  const consoleInfoSpy = test.mock.method(console, 'info');
  const consoleErrorSpy = test.mock.method(console, 'error');

  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 401 });
  }) as typeof fetch;

  const client = new YandexNddClient();

  await assert.rejects(() => client.offersCreate(validOfferCreateBody), /NDD_OFFER_CREATE_FAILED/);

  const [, requestPayload] = consoleInfoSpy.mock.calls.find((call) => call.arguments[0] === '[YANDEX_NDD][request]')?.arguments ?? [];
  assert.equal(requestPayload.hasAuthorization, true);
  assert.match(String(requestPayload.tokenPreview), /^abcdefghij/);

  const [, payload] = consoleErrorSpy.mock.calls[0]?.arguments ?? [];
  assert.equal(payload.httpStatus, 401);
});

test('maps HTML 403 response to smartcaptcha error with details', async () => {
  process.env.YANDEX_NDD_TOKEN = 'token';

  globalThis.fetch = (async () =>
    new Response('<!DOCTYPE html><html><body>uniqueKey=abc123 https://captcha.yandex.ru</body></html>', {
      status: 403,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })) as typeof fetch;

  const client = new YandexNddClient();

  await assert.rejects(
    () => client.offersInfo('10029618814', '11111111-2222-4333-8444-555555555555'),
    (error: any) =>
      error.code === 'YANDEX_SMARTCAPTCHA_BLOCK' &&
      error.status === 403 &&
      error.details?.uniqueKey === 'abc123' &&
      String(error.details?.hintUrl).includes('captcha.yandex.ru')
  );
});

test('retries 5xx responses and succeeds', async () => {
  process.env.YANDEX_NDD_TOKEN = 'token';
  let callCount = 0;

  globalThis.fetch = (async () => {
    callCount += 1;
    if (callCount < 3) {
      return new Response(JSON.stringify({ error: 'upstream' }), { status: 502 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const client = new YandexNddClient();
  const response = await client.offersCreate(validOfferCreateBody);
  assert.equal(callCount, 3);
  assert.equal(response.ok, true);
});

test('does not retry 403 smartcaptcha responses', async () => {
  process.env.YANDEX_NDD_TOKEN = 'token';
  let callCount = 0;

  globalThis.fetch = (async () => {
    callCount += 1;
    return new Response('<html>uniqueKey=only-once</html>', {
      status: 403,
      headers: { 'content-type': 'text/html' }
    });
  }) as typeof fetch;

  const client = new YandexNddClient();
  await assert.rejects(() => client.offersCreate(validOfferCreateBody), /YANDEX_SMARTCAPTCHA_BLOCK/);
  assert.equal(callCount, 1);
});
