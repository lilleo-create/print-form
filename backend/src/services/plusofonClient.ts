import { env } from '../config/env';

const trimSlash = (value: string) => value.replace(/\/$/, '');
const ensureLeadingSlash = (value: string) => (value.startsWith('/') ? value : `/${value}`);

export const plusofonClient = {
  async createReverseFlashCall(input: { phone: string; hookUrl: string }): Promise<{ key: string; phone: string }> {
    const url = `${trimSlash(env.plusofonBaseUrl)}${ensureLeadingSlash(env.plusofonFlashCallEndpoint)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.plusofonFlashAccessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Client: '10553'
      },
      body: JSON.stringify({
        phone: input.phone,
        hook_url: input.hookUrl
      }),
      signal: AbortSignal.timeout(env.plusofonRequestTimeoutMs)
    });

    const rawBody = await response.text();

    console.log('[PLUSOFON] request url', url);
    console.log('[PLUSOFON] status', response.status);
    console.log('[PLUSOFON] raw body', rawBody);

    let payload: any = null;
    try {
      payload = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      throw new Error(`PLUSOFON_INVALID_JSON:${rawBody.slice(0, 500)}`);
    }

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error?.message ||
        rawBody ||
        `HTTP ${response.status}`;
      throw new Error(`PLUSOFON_HTTP_${response.status}:${message}`);
    }

    if (payload?.error) {
      throw new Error(`PLUSOFON_API_ERROR:${payload.error.message || 'Unknown error'}`);
    }

    const key =
      payload?.key ??
      payload?.data?.key ??
      payload?.result?.key;

    const phone =
      payload?.phone ??
      payload?.data?.phone ??
      payload?.result?.phone ??
      payload?.number ??
      payload?.data?.number ??
      payload?.result?.number;

    if (!key || !phone) {
      throw new Error(`PLUSOFON_BAD_RESPONSE:${rawBody.slice(0, 500)}`);
    }

    return { key, phone };
  }
};