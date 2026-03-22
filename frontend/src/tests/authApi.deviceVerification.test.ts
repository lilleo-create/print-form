import { authApi } from '../shared/api/authApi';
import { api } from '../shared/api';

vi.mock('../shared/api', async () => {
  const actual = await vi.importActual('../shared/api');
  return {
    ...actual,
    api: {
      login: vi.fn(),
      register: vi.fn(),
      requestOtp: vi.fn(),
      otpStatus: vi.fn(),
      verifyOtp: vi.fn(),
      updateProfile: vi.fn(),
      logout: vi.fn(),
      getSellerContext: vi.fn(),
    }
  };
});

describe('authApi login device verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps DEVICE_VERIFICATION_REQUIRED response to frontend auth result', async () => {
    const error = new Error('DEVICE_VERIFICATION_REQUIRED') as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = 403;
    error.payload = {
      error: {
        code: 'DEVICE_VERIFICATION_REQUIRED'
      },
      requiresDeviceVerification: true,
      tempToken: 'temp-token',
      requestId: 'request-1',
      verificationMethod: 'existing_otp_flow',
      otpRequest: {
        requestId: 'request-1',
        verificationType: 'call_to_auth',
        callToAuthNumber: '79990000001',
        phone: '79990000000',
        provider: 'plusofon'
      },
      verification: {
        channel: 'PHONE_CALL',
        phone: '79990000000',
        reason: 'Новое устройство'
      },
      user: {
        id: 'user-1',
        name: 'User',
        email: 'user@example.com',
        role: 'buyer',
        phone: '79990000000'
      }
    };

    vi.mocked(api.login).mockRejectedValue(error as never);

    await expect(authApi.login('+79990000000', 'buyer123')).resolves.toEqual({
      requiresOtp: true,
      tempToken: 'temp-token',
      user: expect.objectContaining({
        id: 'user-1',
        role: 'buyer',
        phone: '79990000000'
      }),
      flowType: 'device_login_verification',
      requestId: 'request-1',
      phone: '79990000000',
      verificationMethod: 'existing_otp_flow',
      otpRequest: {
        requestId: 'request-1',
        verificationType: 'call_to_auth',
        callToAuthNumber: '79990000001',
        phone: '79990000000',
        provider: 'plusofon',
        status: undefined,
        expiresInSec: undefined
      },
      verification: {
        channel: 'PHONE_CALL',
        phone: '79990000000',
        reason: 'Новое устройство'
      }
    });
  });
});
