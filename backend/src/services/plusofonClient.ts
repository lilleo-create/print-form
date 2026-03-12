import { env } from '../config/env';

const trimSlash = (value: string) => value.replace(/\/$/, '');
const ensureLeadingSlash = (value: string) => (value.startsWith('/') ? value : `/${value}`);

type PlusofonPayload = {
  key?: string;
  phone?: string;
  number?: string;
  data?: {
    key?: string;
    phone?: string;
    number?: string;
  };
  result?: {
    key?: string;
    phone?: string;
    number?: string;
  };
  error?: {
    code?: number;
    message?: string;
  };
};

const mapPlusofonPayload = (payload: PlusofonPayload) => {
  if (payload.error) {
    throw new Error(`PLUSOFON_API_ERROR:${payload.error.message ?? 'Unknown Plusofon API error'}`);
  }

  const key = payload?.key ?? payload?.data?.key ?? payload?.result?.key;
  const phone =
    payload?.phone ??
    payload?.data?.phone ??
    payload?.result?.phone ??
    payload?.number ??
    payload?.data?.number ??
    payload?.result?.number;

  if (!key || !phone) {
    throw new Error('PLUSOFON_BAD_RESPONSE');
  }

  return { key, phone };
};

export const plusofonClient = {
  async createReverseFlashCall(input: { phone: string; hookUrl: string }): Promise<{ key: string; phone: string }> {
    const endpoint = ensureLeadingSlash(env.plusofonFlashCallEndpoint);
    const response = await fetch(`${trimSlash(env.plusofonBaseUrl)}${endpoint}`, {
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

    const rawBody = await response.text();

    if (!response.ok) {
      throw new Error(`PLUSOFON_HTTP_${response.status}:${rawBody.slice(0, 200)}`);
    }

    let payload: PlusofonPayload;
    try {
      payload = JSON.parse(rawBody) as PlusofonPayload;
    } catch {
      throw new Error('PLUSOFON_BAD_RESPONSE');
    }

    return mapPlusofonPayload(payload);
  }
};
