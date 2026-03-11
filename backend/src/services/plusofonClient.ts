import { env } from '../config/env';

const trimSlash = (value: string) => value.replace(/\/$/, '');

export const plusofonClient = {
  async createReverseFlashCall(input: { phone: string; hookUrl: string }): Promise<{ key: string; phone: string }> {
    const response = await fetch(`${trimSlash(env.plusofonBaseUrl)}/api/v1/flash-call/call-to-auth`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.plusofonFlashAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: input.phone,
        hook_url: input.hookUrl
      }),
      signal: AbortSignal.timeout(env.plusofonRequestTimeoutMs)
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`PLUSOFON_HTTP_${response.status}:${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as { key?: string; phone?: string };
    if (!payload.key || !payload.phone) {
      throw new Error('PLUSOFON_BAD_RESPONSE');
    }

    return { key: payload.key, phone: payload.phone };
  }
};
