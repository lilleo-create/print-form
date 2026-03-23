import type { User, Role } from '../types';
import { loadFromStorage, removeFromStorage, saveToStorage, setAccessToken } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { normalizeApiError } from './client';
import { api } from './index';
import { toCanonicalRuPhone } from '../lib/validation';

interface StoredSession {
  user: User;
}

type VerificationChannel = 'PHONE_CALL' | 'SMS' | 'PUSH' | 'UNKNOWN';

type DeviceVerification = {
  channel: VerificationChannel;
  phone: string | null;
  reason: string | null;
};

export type OtpFlowType = 'registration' | 'device_login_verification' | 'password_reset_verification';
export type OtpVerifyStatus = 'idle' | 'pending' | 'verified' | 'expired' | 'failed' | 'cancelled' | 'error';

export type RegistrationPurpose =
  | 'buyer_register_phone'
  | 'buyer_change_phone'
  | 'buyer_sensitive_action'
  | 'seller_connect_phone'
  | 'seller_change_payout_details'
  | 'seller_payout_settings_verify';

export type OtpRequestResponse = {
  requestId: string;
  provider?: string;
  verificationType: 'call_to_auth' | 'code';
  callToAuthNumber?: string | null;
  phone?: string;
  status?: string;
  expiresInSec?: number;
};

export type OtpFlowState = {
  flowType: OtpFlowType;
  purpose: RegistrationPurpose | null;
  tempToken: string | null;
  requestId: string | null;
  phone: string | null;
  challengePhone: string | null;
  originalUserPhone: string | null;
  otpRequest: OtpRequestResponse | null;
  callToAuthNumber: string | null;
  verificationMethod: string | null;
  cooldownUntil: number | null;
  resendAvailableAt: number | null;
  verifyStatus: OtpVerifyStatus;
  lastError: string | null;
  isPolling: boolean;
  createdAt: number | null;
  updatedAt: number | null;
};

export const getOtpPurposeForFlow = (flowType: OtpFlowType): RegistrationPurpose | null =>
  flowType === 'registration' ? 'buyer_register_phone' : null;

type AuthResult =
  | {
      requiresOtp: true;
      tempToken: string;
      user: User;
      flowType: OtpFlowType;
      verification?: DeviceVerification;
      requestId?: string | null;
      phone?: string | null;
      otpRequest?: OtpRequestResponse | null;
      verificationMethod?: string | null;
    }
  | { requiresOtp: false; token: string; user: User };

type PasswordResetRequestResult = {
  requiresOtp: true;
  flowType: 'password_reset_verification';
  tempToken: string;
  phone: string;
  requestId: string | null;
  otpRequest: OtpRequestResponse | null;
  verificationMethod?: string | null;
  user?: User;
};

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
  requiresPasswordResetVerification?: boolean;
  requires_password_reset_verification?: boolean;
  tempToken?: string;
  temp_token?: string;
  accessToken?: string;
  user?: RawUser;
  verification?: RawDeviceVerification;
  requestId?: string;
  request_id?: string;
  phone?: string | null;
  verificationMethod?: string | null;
  verification_method?: string | null;
  otpRequest?: OtpRequestResponse;
  otp_request?: OtpRequestResponse;
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

const normalizeOtpRequest = (
  data?: OtpRequestResponse | null
): OtpRequestResponse | null => {
  if (!data?.requestId || !data.verificationType) {
    return null;
  }

  return {
    requestId: data.requestId,
    provider: data.provider,
    verificationType: data.verificationType,
    callToAuthNumber: data.callToAuthNumber ?? null,
    phone: data.phone ? toCanonicalRuPhone(data.phone) : data.phone,
    status: data.status,
    expiresInSec: data.expiresInSec,
  };
};

const mapOtpFlowResult = (data: RawAuthData, flowType: OtpFlowType, fallbackPhone: string, fallbackUser?: RawUser): AuthResult => ({
  requiresOtp: true,
  tempToken: data.tempToken ?? data.temp_token ?? '',
  user: data.user ? normalizeUser(data.user) : normalizeUser(fallbackUser ?? { phone: fallbackPhone }),
  flowType,
  verification: normalizeDeviceVerification(data.verification),
  requestId: data.requestId ?? data.request_id ?? data.otpRequest?.requestId ?? data.otp_request?.requestId ?? null,
  phone: toCanonicalRuPhone(data.phone ?? data.verification?.phone ?? data.user?.phone ?? fallbackPhone),
  otpRequest: normalizeOtpRequest(data.otpRequest ?? data.otp_request ?? null),
  verificationMethod: data.verificationMethod ?? data.verification_method ?? null,
});


const unwrapNestedData = <T>(payload: { data: unknown }): T => {
  const outer = payload.data as T | { data?: T };
  if (outer && typeof outer === 'object' && 'data' in outer) {
    return (outer as { data?: T }).data ?? (outer as T);
  }
  return outer as T;
};
export const authApi = {
  login: async (phone: string, password: string): Promise<AuthResult> => {
    try {
      const result = await api.login({ phone, password });
      const data = unwrapNestedData<RawAuthData>(result);

      const requiresOtp = data.requiresOtp ?? data.requires_otp ?? false;
      const tempToken = data.tempToken ?? data.temp_token ?? '';

      if (requiresOtp) {
        return {
          requiresOtp: true,
          tempToken,
          user: requireUser(data, 'Login'),
          flowType: 'registration'
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

      if (!requiresDeviceVerification || !data) {
        throw error;
      }

      return mapOtpFlowResult(data, 'device_login_verification', phone);
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
    try {
      const result = await api.register({
        name: payload.name,
        fullName: payload.fullName,
        email: payload.email,
        password: payload.password,
        phone: payload.phone,
        address: payload.address,
        privacyAccepted: payload.privacyAccepted
      });

      const data = unwrapNestedData<RawAuthData>(result);

      const requiresOtp = data.requiresOtp ?? data.requires_otp ?? false;
      const tempToken = data.tempToken ?? data.temp_token ?? '';

      if (requiresOtp) {
        return {
          requiresOtp: true,
          tempToken,
          user: requireUser(data, 'Register'),
          flowType: 'registration'
        };
      }

      const token = data.accessToken ?? '';
      const user = requireUser(data, 'Register');

      return { requiresOtp: false, token, user };
    } catch (error) {
      const data = extractErrorData(error);
      const requiresOtp = data?.requiresOtp ?? data?.requires_otp ?? false;
      const tempToken = data?.tempToken ?? data?.temp_token ?? '';

      if (requiresOtp && data?.user && tempToken) {
        return {
          requiresOtp: true,
          tempToken,
          user: normalizeUser(data.user),
          flowType: 'registration'
        };
      }

      throw error;
    }
  },

  requestOtp: async (
    payload: { phone: string; purpose?: RegistrationPurpose },
    token?: string | null
  ): Promise<OtpRequestResponse | null> => {
    const response = await api.requestOtp(payload, token);
    const raw = response.data as unknown as
      | {
          ok?: boolean;
          data?: OtpRequestResponse;
          delivery?: OtpRequestResponse;
        }
      | undefined;

    return normalizeOtpRequest(raw?.data ?? raw?.delivery ?? null);
  },

  requestDeviceLoginOtp: async (payload: { phone: string }, tempToken: string) => {
    const response = await api.requestOtp(payload, tempToken);
    const raw = response.data as unknown as { data?: OtpRequestResponse; delivery?: OtpRequestResponse } | undefined;
    return normalizeOtpRequest(raw?.data ?? raw?.delivery ?? null);
  },

  checkOtpStatus: async (requestId: string, token?: string | null) => {
    const response = await api.otpStatus(requestId, token);
    const raw = response.data as unknown as
      | {
          status?: 'pending' | 'verified' | 'expired' | 'failed' | 'cancelled';
          data?: { status?: 'pending' | 'verified' | 'expired' | 'failed' | 'cancelled' };
        }
      | undefined;
    return (raw?.data?.status ?? raw?.status ?? 'pending');
  },

  verifyOtp: async (
    payload: { phone: string; code?: string; requestId?: string; purpose?: RegistrationPurpose },
    token?: string | null
  ) => {
    const result = await api.verifyOtp(payload, token);

    const data = unwrapNestedData<{ accessToken?: string; user?: RawUser }>(result);

    const session = {
      token: data.accessToken ?? '',
      user: normalizeUser(data.user)
    };

    if (!session.token || !session.user.id) {
      throw new Error('OTP verify: invalid response');
    }
    return session;
  },

  verifyDeviceLoginOtp: async (payload: { phone: string; requestId?: string }, tempToken: string) => {
    const result = await api.verifyOtp(payload, tempToken);
    const data = unwrapNestedData<{ accessToken?: string; user?: RawUser }>(result);
    const session = {
      token: data.accessToken ?? '',
      user: normalizeUser(data.user)
    };
    if (!session.token || !session.user.id) {
      throw new Error('Device login OTP verify: invalid response');
    }
    return session;
  },

  requestPasswordReset: async (payload: { phone: string }): Promise<PasswordResetRequestResult> => {
    try {
      const response = await api.requestPasswordReset(payload);
      const raw = response.data as unknown as RawAuthData & { delivery?: OtpRequestResponse };
      const otpRequest = normalizeOtpRequest(raw.otpRequest ?? raw.otp_request ?? raw.delivery ?? null);

      if (!otpRequest) {
        throw new Error('Password reset OTP request: invalid response');
      }

      return {
        requiresOtp: true,
        flowType: 'password_reset_verification',
        tempToken: raw.tempToken ?? raw.temp_token ?? '',
        phone: toCanonicalRuPhone(raw.phone ?? otpRequest.phone ?? payload.phone),
        requestId: raw.requestId ?? raw.request_id ?? otpRequest.requestId ?? null,
        otpRequest,
        verificationMethod: raw.verificationMethod ?? raw.verification_method ?? null,
        user: raw.user ? normalizeUser(raw.user) : undefined,
      };
    } catch (error) {
      const normalized = normalizeApiError(error);
      const data = extractErrorData(error);
      const requiresPasswordResetVerification =
        normalized.code === 'PASSWORD_RESET_VERIFICATION_REQUIRED' ||
        data?.code === 'PASSWORD_RESET_VERIFICATION_REQUIRED' ||
        data?.requiresPasswordResetVerification === true ||
        data?.requires_password_reset_verification === true;

      if (!requiresPasswordResetVerification || !data) {
        throw error;
      }

      return {
        requiresOtp: true,
        flowType: 'password_reset_verification',
        tempToken: data.tempToken ?? data.temp_token ?? '',
        phone: toCanonicalRuPhone(data.phone ?? data.otpRequest?.phone ?? data.otp_request?.phone ?? payload.phone),
        requestId: data.requestId ?? data.request_id ?? data.otpRequest?.requestId ?? data.otp_request?.requestId ?? null,
        otpRequest: normalizeOtpRequest(data.otpRequest ?? data.otp_request ?? null),
        verificationMethod: data.verificationMethod ?? data.verification_method ?? null,
        user: data.user ? normalizeUser(data.user) : undefined,
      };
    }
  },

  completePasswordResetVerification: async (
    payload: { phone: string; requestId?: string; code?: string },
    tempToken?: string | null
  ) => {
    const response = await api.verifyPasswordReset(payload, tempToken ?? undefined);
    return response.data.resetToken;
  },

  confirmPasswordReset: async (payload: { token: string; password: string }) => {
    return api.confirmPasswordReset(payload);
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
