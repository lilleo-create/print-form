import { create } from 'zustand';
import { authApi, getOtpPurposeForFlow, type OtpFlowState, type OtpFlowType, type RegistrationPurpose } from '../../shared/api/authApi';
import { api } from '../../shared/api';
import { loadFromStorage, removeFromStorage, saveToStorage, setAccessToken } from '../../shared/lib/storage';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { User, Role } from '../../shared/types';
import { normalizeRole } from '../../shared/lib/authAccess';

type DeviceVerificationChannel = 'PHONE_CALL' | 'SMS' | 'PUSH' | 'UNKNOWN';

type OtpRequiredResult = {
  requiresOtp: true;
  tempToken: string;
  user: User;
  flowType: OtpFlowType;
  verification?: {
    channel: DeviceVerificationChannel;
    phone: string | null;
    reason: string | null;
  };
  requestId?: string | null;
  phone?: string | null;
  verificationMethod?: string | null;
  otpRequest?: {
    requestId: string;
    provider?: string;
    verificationType: 'call_to_auth' | 'code';
    callToAuthNumber?: string | null;
    phone?: string;
    status?: string;
    expiresInSec?: number;
  } | null;
};

type AuthSuccessResult = {
  requiresOtp: false;
  token: string;
  user: User;
};

type AuthResult = OtpRequiredResult | AuthSuccessResult;

const isOtpRequired = (r: AuthResult): r is OtpRequiredResult => 'requiresOtp' in r && r.requiresOtp === true;

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthInitialized: boolean;
  isRestoringSession: boolean;
  isAuthenticated: boolean;

  otp: OtpFlowState & {
    required: boolean;
    user: User | null;
    verification: {
      channel: DeviceVerificationChannel;
      phone: string | null;
      reason: string | null;
    } | null;
  };

  setOtpState: (v: Partial<AuthState['otp']>) => void;
  clearOtp: () => void;
  initializeAuth: () => Promise<void>;

  login: (phone: string, password: string) => Promise<
    | {
        requiresOtp: true;
        tempToken?: string;
        user?: User;
        flowType?: OtpFlowType;
        verification?: {
          channel: DeviceVerificationChannel;
          phone: string | null;
          reason: string | null;
        };
        requestId?: string | null;
        phone?: string | null;
        verificationMethod?: string | null;
        otpRequest?: {
          requestId: string;
          provider?: string;
          verificationType: 'call_to_auth' | 'code';
          callToAuthNumber?: string | null;
          phone?: string;
          status?: string;
          expiresInSec?: number;
        } | null;
      }
    | {
        requiresOtp: false;
        user?: User;
        token?: string;
      }
  >;

  register: (payload: {
    name: string;
    fullName: string;
    email: string;
    password: string;
    role?: Role;
    phone: string;
    address?: string;
    privacyAccepted?: boolean;
  }) => Promise<{
    requiresOtp: boolean;
    tempToken?: string;
    user?: User | null;
    token?: string;
  }>;

  requestOtp: (payload: { phone: string; purpose?: RegistrationPurpose }, token?: string | null) => Promise<{ requestId: string; provider?: string; verificationType: 'call_to_auth' | 'code'; callToAuthNumber?: string | null; phone?: string; status?: string; expiresInSec?: number } | null>;
  requestDeviceLoginOtp: (payload: { phone: string }, token?: string | null) => Promise<{ requestId: string; provider?: string; verificationType: 'call_to_auth' | 'code'; callToAuthNumber?: string | null; phone?: string; status?: string; expiresInSec?: number } | null>;

  checkOtpStatus: (requestId: string, token?: string | null) => Promise<'pending' | 'verified' | 'expired' | 'failed' | 'cancelled'>;
  verifyOtp: (
    payload: { phone: string; code?: string; requestId?: string; purpose?: RegistrationPurpose },
    token?: string | null
  ) => Promise<void>;
  verifyDeviceLoginOtp: (payload: { phone: string; requestId?: string }, token?: string | null) => Promise<void>;

  updateProfile: (payload: { name?: string; fullName?: string; email?: string; phone?: string; address?: string }) => Promise<void>;

  setUser: (user: User) => void;
  logout: () => Promise<void>;
  hydrate: () => void;
}

type StoredSession = { user: User } | { user: User; token?: string };

const loadStoredUser = () => {
  try {
    const session = loadFromStorage<StoredSession | null>(STORAGE_KEYS.session, null);
    return session?.user ?? null;
  } catch {
    return null;
  }
};

const loadStoredToken = () => {
  try {
    return loadFromStorage<string | null>(STORAGE_KEYS.accessToken, null);
  } catch {
    return null;
  }
};

const saveStoredUser = (user: User | null) => {
  if (!user) {
    removeFromStorage(STORAGE_KEYS.session);
    return;
  }
  saveToStorage(STORAGE_KEYS.session, { user });
};

const emptyOtp: AuthState['otp'] = {
  required: false,
  purpose: null,
  tempToken: null,
  phone: null,
  challengePhone: null,
  originalUserPhone: null,
  user: null,
  flowType: 'registration',
  verification: null,
  requestId: null,
  verificationMethod: null,
  otpRequest: null,
  callToAuthNumber: null,
  cooldownUntil: null,
  resendAvailableAt: null,
  verifyStatus: 'idle',
  lastError: null,
  isPolling: false,
  createdAt: null,
  updatedAt: null,
};

let initializeAuthPromise: Promise<void> | null = null;
const IS_TEST_ENV = typeof import.meta !== 'undefined' && import.meta.env.MODE === 'test';

export const useAuthStore = create<AuthState>((set, get) => {
  const storedUser = loadStoredUser();
  const storedToken = loadStoredToken();

  return {
    user: storedUser,
    token: storedToken,
    isAuthInitialized: IS_TEST_ENV,
    isRestoringSession: false,
    isAuthenticated: Boolean(storedUser),

    otp: { ...emptyOtp },

    setOtpState(v) {
      set({ otp: { ...get().otp, ...v } });
    },

    clearOtp() {
      set({ otp: { ...emptyOtp } });
    },

    async initializeAuth() {
      if (get().isAuthInitialized) {
        return;
      }

      if (!initializeAuthPromise) {
        set({ isRestoringSession: true });
        initializeAuthPromise = (async () => {
          try {
            const response = await api.me();
            const profile = response.data;
            const user: User = {
              ...profile,
              name: profile.name ?? '',
              role: normalizeRole(profile.role),
              roles: profile.roles ?? null,
              capabilities: profile.capabilities ?? null,
            };
            saveStoredUser(user);
            set({
              user,
              isAuthenticated: true,
            });
          } catch {
            removeFromStorage(STORAGE_KEYS.session);
            setAccessToken(null);
            set({
              user: null,
              token: null,
              isAuthenticated: false,
            });
          } finally {
            set({ isAuthInitialized: true, isRestoringSession: false });
          }
        })().finally(() => {
          initializeAuthPromise = null;
        });
      }

      await initializeAuthPromise;
    },

    async login(phone, password) {
      get().clearOtp();

      const raw = await authApi.login(phone, password);
      if (!raw) throw new Error('Login failed: empty response');

      const result = raw as AuthResult;

      if (isOtpRequired(result)) {
        const now = Date.now();
        set({
          otp: {
            required: true,
            purpose: getOtpPurposeForFlow(result.flowType),
            tempToken: result.tempToken,
            phone: result.phone ?? result.user.phone ?? null,
            challengePhone: result.otpRequest?.phone ?? result.phone ?? result.verification?.phone ?? result.user.phone ?? null,
            originalUserPhone: result.user.phone ?? result.phone ?? null,
            user: result.user,
            flowType: result.flowType,
            verification: result.verification ?? null,
            requestId: result.requestId ?? result.otpRequest?.requestId ?? null,
            verificationMethod: result.verificationMethod ?? null,
            otpRequest: result.otpRequest ?? null,
            callToAuthNumber: result.otpRequest?.callToAuthNumber ?? null,
            cooldownUntil: null,
            resendAvailableAt: null,
            verifyStatus: 'pending',
            lastError: null,
            isPolling: Boolean(result.otpRequest?.requestId),
            createdAt: now,
            updatedAt: now,
          },
        });
        return {
          requiresOtp: true,
          tempToken: result.tempToken,
          user: result.user,
          flowType: result.flowType,
          verification: result.verification,
          requestId: result.requestId ?? null,
          phone: result.phone ?? null,
          verificationMethod: result.verificationMethod ?? null,
          otpRequest: result.otpRequest ?? null,
        };
      }

      saveStoredUser(result.user);
      setAccessToken(result.token);
      set({ user: result.user, token: result.token, isAuthenticated: true, isAuthInitialized: true });
      return { requiresOtp: false, user: result.user, token: result.token };
    },

    async register(payload) {
      get().clearOtp();

      const raw = await authApi.register(payload);
      if (!raw) throw new Error('Register failed: empty response');

      const result = raw as AuthResult;

      if (isOtpRequired(result)) {
        const now = Date.now();
        set({
          otp: {
            required: true,
            purpose: 'buyer_register_phone',
            tempToken: result.tempToken,
            phone: payload.phone ?? result.user.phone ?? null,
            challengePhone: result.otpRequest?.phone ?? payload.phone ?? result.user.phone ?? null,
            originalUserPhone: result.user.phone ?? payload.phone ?? null,
            user: result.user,
            flowType: 'registration',
            verification: null,
            requestId: null,
            verificationMethod: null,
            otpRequest: null,
            callToAuthNumber: null,
            cooldownUntil: null,
            resendAvailableAt: null,
            verifyStatus: 'pending',
            lastError: null,
            isPolling: false,
            createdAt: now,
            updatedAt: now,
          },
        });
        return { requiresOtp: true, tempToken: result.tempToken, user: result.user };
      }

      saveStoredUser(result.user);
      setAccessToken(result.token);
      set({ user: result.user, token: result.token, isAuthenticated: true, isAuthInitialized: true });
      return { requiresOtp: false, user: result.user, token: result.token };
    },

    async requestOtp(payload, token) {
      const purpose = (payload.purpose ?? get().otp.purpose ?? 'buyer_register_phone') as RegistrationPurpose;
      const finalPayload = { ...payload, purpose };

      return await authApi.requestOtp(finalPayload, token ?? get().otp.tempToken ?? get().token);
    },

    async requestDeviceLoginOtp(payload, token) {
      const otpToken = token ?? get().otp.tempToken;
      if (!otpToken) {
        throw new Error('Device login OTP request: temp token missing');
      }
      return await authApi.requestDeviceLoginOtp(payload, otpToken);
    },

    async checkOtpStatus(requestId, token) {
      return await authApi.checkOtpStatus(requestId, token ?? get().otp.tempToken ?? get().token);
    },

    async verifyOtp(payload, token) {
      const otp = get().otp;
      const purpose = (payload.purpose ?? otp.purpose ?? 'buyer_register_phone') as RegistrationPurpose;

      const finalPayload = { ...payload, purpose };
      const result = await authApi.verifyOtp(finalPayload, token ?? otp.tempToken ?? get().token);

      if (!result?.user || !result?.token) {
        throw new Error('OTP verify failed: invalid response');
      }

      set({
        user: result.user,
        token: result.token,
        otp: { ...emptyOtp },
        isAuthenticated: true,
        isAuthInitialized: true,
      });
      saveStoredUser(result.user);
      setAccessToken(result.token);
    },

    async verifyDeviceLoginOtp(payload, token) {
      const otpToken = token ?? get().otp.tempToken;
      if (!otpToken) {
        throw new Error('Device login OTP verify: temp token missing');
      }
      const result = await authApi.verifyDeviceLoginOtp(payload, otpToken);
      set({
        user: result.user,
        token: result.token,
        otp: { ...emptyOtp },
        isAuthenticated: true,
        isAuthInitialized: true,
      });
      saveStoredUser(result.user);
      setAccessToken(result.token);
    },

    async updateProfile(payload) {
      const result = await authApi.updateProfile(payload);

      if (result?.user) {
        const user: User = {
          ...result.user,
          role: normalizeRole(result.user.role),
        };
        set({ user, isAuthenticated: true });
        saveStoredUser(user);
      }
    },

    setUser(user) {
      authApi.setSessionUser?.(user);
      saveStoredUser(user);
      set({ user, isAuthenticated: true, isAuthInitialized: true });
    },

    async logout() {
      try {
        await authApi.logout();
      } catch {
        // ignore
      } finally {
        removeFromStorage(STORAGE_KEYS.session);
        setAccessToken(null);
        set({ user: null, token: null, otp: { ...emptyOtp }, isAuthenticated: false, isAuthInitialized: true, isRestoringSession: false });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth:logout'));
        }
      }
    },

    hydrate() {
      const user = loadStoredUser();
      const token = loadStoredToken();
      set({ user, token, isAuthenticated: Boolean(user) });
    },
  };
});

if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    removeFromStorage(STORAGE_KEYS.session);
    setAccessToken(null);
    useAuthStore.setState({ user: null, token: null, otp: { ...emptyOtp }, isAuthenticated: false, isRestoringSession: false, isAuthInitialized: true });
  });
}
