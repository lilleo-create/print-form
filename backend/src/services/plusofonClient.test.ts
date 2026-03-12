import test from 'node:test';
import assert from 'node:assert/strict';
import { plusofonClient } from './plusofonClient';
import { env } from '../config/env';

test('maps flat plusofon payload', async () => {
  env.plusofonBaseUrl = 'https://restapi.plusofon.ru';
  env.plusofonFlashCallEndpoint = '/flash-call/call-to-auth';
  env.plusofonFlashAccessToken = 'token';
  env.plusofonRequestTimeoutMs = 1000;

  (globalThis.fetch as any) = async (input: RequestInfo | URL) => {
    assert.equal(String(input), 'https://restapi.plusofon.ru/flash-call/call-to-auth');
    return new Response(JSON.stringify({ key: 'k1', phone: '+78005553535' }), { status: 200 });
  };

  const result = await plusofonClient.createReverseFlashCall({ phone: '+79990000000', hookUrl: 'https://example.com/webhook' });
  assert.deepEqual(result, { key: 'k1', phone: '+78005553535' });
});

test('maps nested plusofon payload', async () => {
  (globalThis.fetch as any) = async () => {
    return new Response(JSON.stringify({ data: { key: 'k2', phone: '+78005550000' } }), { status: 200 });
  };

  const result = await plusofonClient.createReverseFlashCall({ phone: '+79990000000', hookUrl: 'https://example.com/webhook' });
  assert.deepEqual(result, { key: 'k2', phone: '+78005550000' });
});

test('throws readable plusofon api error', async () => {
  (globalThis.fetch as any) = async () => {
    return new Response(JSON.stringify({ jsonrpc: '2.0', result: null, error: { code: 0, message: 'Page not found.' } }), { status: 200 });
  };

  await assert.rejects(
    () => plusofonClient.createReverseFlashCall({ phone: '+79990000000', hookUrl: 'https://example.com/webhook' }),
    /PLUSOFON_API_ERROR:Page not found./
  );
});
