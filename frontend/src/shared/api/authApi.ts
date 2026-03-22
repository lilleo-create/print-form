import type { User, Role } from '../types';
import { loadFromStorage, removeFromStorage, saveToStorage, setAccessToken } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { normalizeApiError } from './client';
import { api } from './index';

interface StoredSession {
  user: User;
}

type VerificationChannel = 'PHONE_CALL' | 'SMS' | 'PUSH' | 'UNKNOWN';

type DeviceVerification = {
  channel: VerificationChannel;
  phone: string | null;
  reason: string | null;
};

type AuthResult =
  | { requiresOtp: true; tempToken: string; user: User }
  | { requiresDeviceVerification: true; tempToken: string; user: User | null; verification: DeviceVerification }
  | { requiresOtp: false; token: string; user: User };

type RawUser = {
  id?: string;
  name?: string;
  email?: string;
  fullName?: string | null;
  phone?: string | null;
  address?: string | null;
  role?: string;
};

type RawDeviceVerification = {
  channel?: string;
  phone?: string | null;
  reason?: string | null;
};

type RawAuthData = {
  code?: string;
  requiresOtp?: boolean;
  requires_otp?: boolean;
  requiresDeviceVerification?: boolean;
  requires_device_verification?: boolean;
  tempToken?: string;
  temp_token?: string;
  accessToken?: string;
  user?: RawUser;
  verification?: RawDeviceVerification;
};

type RawDeviceVerificationStatus = {
  status?: 'pending' | 'verified' | 'expired' | 'failed' | 'cancelled';
  verificationResult?: string | Record<string, unknown> | null;
  verification_result?: string | Record<string, unknown> | null;
  result?: string | Record<string, unknown> | null;
  data?: {
    status?: 'pending' | 'verified' | 'expired' | 'failed' | 'cancelled';
    verificationResult?: string | Record<string, unknown> | null;
    verification_result?: string | Record<string, unknown> | null;
    result?: string | Record<string, unknown> | null;
  };
};

const normalizeRole = (role?: string): Role => {
  const r = (role ?? '').toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'seller') return 'seller';
  return 'buyer';
};

const normalizeUser = (u?: RawUser): User => ({
  id: u?.id ?? '',
  name: u?.name ?? '',
  email: u?.email ?? '',
  fullName: u?.fullName ?? null,
  phone: u?.phone ?? null,
  address: u?.address ?? null,
  role: normalizeRole(u?.role)
});

const normalizeVerificationChannel = (channel?: string): VerificationChannel => {
  const normalized = (channel ?? '').toUpperCase();
  if (normalized === 'PHONE_CALL' || normalized === 'SMS' || normalized === 'PUSH') {
    return normalized;
  }
  return 'UNKNOWN';
};

const normalizeDeviceVerification = (verification?: RawDeviceVerification): DeviceVerification => ({
  channel: normalizeVerificationChannel(verification?.channel),
  phone: verification?.phone ?? null,
  reason: verification?.reason ?? null,
});

function requireUser(data: RawAuthData, context: string): User {
  if (!data.user) {
    throw new Error(`${context}: user missing in response`);
  }
  return normalizeUser(data.user);
}

const extractErrorData = (error: unknown): RawAuthData | null => {
  if (!error || typeof error !== 'object') return null;
  const payload = 'payload' in error ? (error as { payload?: unknown }).payload : undefined;
  if (!payload || typeof payload !== 'object') return null;

  const direct = payload as RawAuthData & { error?: RawAuthData };
  if (direct.error && typeof direct.error === 'object') {
    return {
      ...direct,
      ...direct.error,
      verification: direct.verification ?? direct.error.verification,
      user: direct.user ?? direct.error.user,
    };
  }

  return direct;
};

export const authApi = {
  login: async (phone: string, password: string): Promise<AuthResult> => {
    try {
      const result = await api.login({ phone, password });
      const data = result.data as RawAuthData;

      const requiresOtp = data.requiresOtp ?? data.requires_otp ?? false;
      const tempToken = data.tempToken ?? data.temp_token ?? '';

      if (requiresOtp) {
        return {
          requiresOtp: true,
          tempToken,
          user: requireUser(data, 'Login')
        };
      }

      const token = data.accessToken ?? '';
      const user = requireUser(data, 'Login');

      return { requiresOtp: false, token, user };
    } catch (error) {
      const normalized = normalizeApiError(error);
      const data = extractErrorData(error);
      const requiresDeviceVerification =
        normalized.code === 'DEVICE_VERIFICATION_REQUIRED' ||
        data?.code === 'DEVICE_VERIFICATION_REQUIRED' ||
        data?.requiresDeviceVerification === true ||
        data?.requires_device_verification === true;

      if (!requiresDeviceVerification) {
        throw error;
      }

      return {
        requiresDeviceVerification: true,
        tempToken: data?.tempToken ?? data?.temp_token ?? '',
        user: data?.user ? normalizeUser(data.user) : null,
        verification: normalizeDeviceVerification(data?.verification),
      };
    }
  },

  register: async (payload: {
    name: string;
    fullName: string;
    email: string;
    password: string;
    role?: Role;
    phone: string;
    address?: string;
    privacyAccepted?: boolean;
  }): Promise<AuthResult> => {
    const result = await api.register({
      name: payload.name,
      fullName: payload.fullName,
      email: payload.email,
      password: payload.password,
      phone: payload.phone,
      address: payload.address,
      privacyAccepted: payload.privacyAccepted
    });

    const data = result.data as RawAuthData;

    const requiresOtp = data.requiresOtp ?? data.requires_otp ?? false;
    const tempToken = data.tempToken ?? data.temp_token ?? '';

    if (requiresOtp) {
      return {
        requiresOtp: true,
        tempToken,
        user: requireUser(data, 'Register')
      };
    }

    const token = data.accessToken ?? '';
    const user = requireUser(data, 'Register');

    return { requiresOtp: false, token, user };
  },

  requestOtp: async (
    payload: { phone: string; purpose?: 'buyer_register_phone' | 'buyer_change_phone' | 'buyer_sensitive_action' | 'seller_connect_phone' | 'seller_change_payout_details' | 'seller_payout_settings_verify' },
    token?: string | null
  ) => {
    const response = await api.requestOtp(payload, token);
    const raw = response.data as
      | {
          ok?: boolean;
          data?: {
            requestId?: string;
            provider?: string;
            verificationType?: 'call_to_auth' | 'code';
            callToAuthNumber?: string | null;
            phone?: string;
            status?: string;
            expiresInSec?: number;
          };
          requestId?: string;
          provider?: string;
          verificationType?: 'call_to_auth' | 'code';
          callToAuthNumber?: string | null;
          phone?: string;
          status?: string;
          expiresInSec?: number;
        }
      | undefined;

    const data = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
    if (!data?.requestId || !data?.verificationType) return null;

    return {
      requestId: data.requestId,
      provider: data.provider,
      verificationType: data.verificationType,
      callToAuthNumber: data.callToAuthNumber ?? null,
      phone: data.phone,
      status: data.status,
      expiresInSec: data.expiresInSec,
    };
  },

  checkOtpStatus: async (requestId: string, token?: string | null) => {
    const response = await api.otpStatus(requestId, token);
    const raw = response.data as
      | {
          status?: 'pending' | 'verified' | 'expired' | 'failed' | 'cancelled';
          data?: { status?: 'pending' | 'verified' | 'expired' | 'failed' | 'cancelled' };
        }
      | undefined;
    return (raw?.data?.status ?? raw?.status ?? 'pending');
  },

  verifyOtp: async (
    payload: { phone: string; code?: string; requestId?: string; purpose?: 'buyer_register_phone' | 'buyer_change_phone' | 'buyer_sensitive_action' | 'seller_connect_phone' | 'seller_change_payout_details' | 'seller_payout_settings_verify' },
    token?: string | null
  ) => {
    const result = await api.verifyOtp(payload, token);

    const data = result.data as { accessToken?: string; user?: RawUser };

    const session = {
      token: data.accessToken ?? '',
      user: normalizeUser(data.user)
    };

    if (!session.token || !session.user.id) {
      throw new Error('OTP verify: invalid response');
    }
    return session;
  },

  checkDeviceVerificationStatus: async (token: string) => {
    const response = await api.deviceVerificationStatus(token);
    const raw = response.data as RawDeviceVerificationStatus | undefined;
    const data = raw?.data && typeof raw.data === 'object' ? raw.data : raw;

    return {
      status: data?.status ?? 'pending',
      verificationResult: data?.verificationResult ?? data?.verification_result ?? data?.result ?? null,
    };
  },

  verifyDevice: async (payload: { verificationResult?: string | Record<string, unknown> | null }, token: string) => {
    const result = await api.verifyDeviceVerification(payload, token);
    const data = result.data as { accessToken?: string; user?: RawUser };

    const session = {
      token: data.accessToken ?? '',
      user: normalizeUser(data.user)
    };

    if (!session.token || !session.user.id) {
      throw new Error('Device verification: invalid response');
    }

    return session;
  },

  updateProfile: async (payload: { name?: string; fullName?: string; email?: string; phone?: string; address?: string }) => {
    const result = await api.updateProfile(payload);
    const responseData = result.data as RawUser | { data?: RawUser } | undefined;
    const updatedUser =
      responseData && typeof responseData === 'object' && 'data' in responseData
        ? responseData.data
        : responseData;

    if (!updatedUser) return null;
    return { user: normalizeUser(updatedUser as RawUser) };
  },

  logout: async () => {
    await api.logout();
    removeFromStorage(STORAGE_KEYS.session);
    setAccessToken(null);
  },

  getSession: () => {
    const session = loadFromStorage<StoredSession | null>(STORAGE_KEYS.session, null);
    const token = loadFromStorage<string | null>(STORAGE_KEYS.accessToken, null);
    if (!session?.user && !token) return null;
    return { user: session?.user ?? null, token };
  },

  setSessionUser: (user: User) => {
    if (!user) {
      removeFromStorage(STORAGE_KEYS.session);
      return null;
    }
    const nextSession = { user };
    saveToStorage(STORAGE_KEYS.session, nextSession);
    return nextSession;
  }
};
