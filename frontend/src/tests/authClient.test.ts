import { authApi } from '../shared/api/authApi';
import { createFetchClient } from '../shared/api/client';
import { STORAGE_KEYS } from '../shared/constants/storageKeys';

describe('auth client refresh guards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('does not trigger refresh for login 401 responses', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    const client = createFetchClient('https://example.test');

    await expect(
      client.request('/auth/login', {
        method: 'POST',
        body: { phone: '+79990000000', password: 'wrongpass' }
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/auth/login');
  });

  it('sends only phone and password in login payload', async () => {
    const apiModule = await import('../shared/api');
    const loginMock = vi.spyOn(apiModule.api, 'login').mockResolvedValue({
      data: {
        accessToken: 'token',
        user: {
          id: 'user-1',
          name: 'User',
          email: 'user@example.com',
          role: 'buyer',
          phone: '+79990000000'
        }
      }
    });

    await authApi.login('+79990000000', 'buyer123');

    expect(loginMock).toHaveBeenCalledWith({
      phone: '+79990000000',
      password: 'buyer123'
    });
  });

  it('does not attach stale bearer token to public auth endpoints', async () => {
    window.localStorage.setItem(STORAGE_KEYS.accessToken, JSON.stringify('stale-token'));

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    const client = createFetchClient('https://example.test');

    await expect(
      client.request('/auth/password-reset/request', {
        method: 'POST',
        body: { phone: '+79990000000' }
      })
    ).rejects.toMatchObject({ status: 401 });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect((init as RequestInit | undefined)?.headers).not.toMatchObject({
      Authorization: 'Bearer stale-token'
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
