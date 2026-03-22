import { create } from 'zustand';
import { authApi } from '../../shared/api/authApi';
import { loadFromStorage, removeFromStorage, saveToStorage, setAccessToken } from '../../shared/lib/storage';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { User, Role } from '../../shared/types';

type Purpose = 'buyer_register_phone' | 'buyer_change_phone' | 'buyer_sensitive_action' | 'seller_connect_phone' | 'seller_change_payout_details' | 'seller_payout_settings_verify';
type DeviceVerificationStatus = 'pending' | 'verified' | 'expired' | 'failed' | 'cancelled';
type DeviceVerificationChannel = 'PHONE_CALL' | 'SMS' | 'PUSH' | 'UNKNOWN';

type OtpRequiredResult = {
  requiresOtp: true;
  tempToken: string;
  user: User;
};

type DeviceVerificationRequiredResult = {
  requiresDeviceVerification: true;
  tempToken: string;
  user?: User | null;
  verification: {
    channel: DeviceVerificationChannel;
    phone: string | null;
    reason: string | null;
  };
};

type AuthSuccessResult = {
  requiresOtp: false;
  token: string;
  user: User;
};

type AuthResult = OtpRequiredResult | DeviceVerificationRequiredResult | AuthSuccessResult;

const isOtpRequired = (r: AuthResult): r is OtpRequiredResult => 'requiresOtp' in r && r.requiresOtp === true;
const isDeviceVerificationRequired = (r: AuthResult): r is DeviceVerificationRequiredResult => 'requiresDeviceVerification' in r && r.requiresDeviceVerification === true;

interface AuthState {
  user: User | null;
  token: string | null;

  otp: {
    required: boolean;
    purpose: Purpose | null;
    tempToken: string | null;
    phone: string | null;
    user: User | null;
  };

  deviceVerification: {
    required: boolean;
    tempToken: string | null;
    user: User | null;
    verification: {
      channel: DeviceVerificationChannel;
      phone: string | null;
      reason: string | null;
    } | null;
  };

  setOtpState: (v: Partial<AuthState['otp']>) => void;
  clearOtp: () => void;
  clearDeviceVerification: () => void;

  login: (phone: string, password: string) => Promise<
    | {
        requiresOtp: true;
        tempToken?: string;
        user?: User;
      }
    | {
        requiresDeviceVerification: true;
        tempToken?: string;
        user?: User | null;
        verification: {
          channel: DeviceVerificationChannel;
          phone: string | null;
          reason: string | null;
        };
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

  requestOtp: (payload: { phone: string; purpose?: Purpose }, token?: string | null) => Promise<{ requestId: string; provider?: string; verificationType: 'call_to_auth' | 'code'; callToAuthNumber?: string | null; phone?: string; status?: string; expiresInSec?: number } | null>;

  checkOtpStatus: (requestId: string, token?: string | null) => Promise<'pending' | 'verified' | 'expired' | 'failed' | 'cancelled'>;
  checkDeviceVerificationStatus: (token?: string | null) => Promise<{ status: DeviceVerificationStatus; verificationResult?: string | Record<string, unknown> | null }>;
  completeDeviceVerification: (payload: { verificationResult?: string | Record<string, unknown> | null }, token?: string | null) => Promise<void>;

  verifyOtp: (
    payload: { phone: string; code?: string; requestId?: string; purpose?: Purpose },
    token?: string | null
  ) => Promise<void>;

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
  user: null,
};

const emptyDeviceVerification: AuthState['deviceVerification'] = {
  required: false,
  tempToken: null,
  user: null,
  verification: null,
};

export const useAuthStore = create<AuthState>((set, get) => {
  const storedUser = loadStoredUser();
  const storedToken = loadStoredToken();

  return {
    user: storedUser,
    token: storedToken,

    otp: { ...emptyOtp },
    deviceVerification: { ...emptyDeviceVerification },

    setOtpState(v) {
      set({ otp: { ...get().otp, ...v } });
    },

    clearOtp() {
      set({ otp: { ...emptyOtp } });
    },

    clearDeviceVerification() {
      set({ deviceVerification: { ...emptyDeviceVerification } });
    },

    async login(phone, password) {
      get().clearOtp();
      get().clearDeviceVerification();

      const raw = await authApi.login(phone, password);
      if (!raw) throw new Error('Login failed: empty response');

      const result = raw as AuthResult;

      if (isOtpRequired(result)) {
        set({
          otp: {
            required: true,
            purpose: 'buyer_register_phone',
            tempToken: result.tempToken,
            phone: result.user.phone ?? null,
            user: result.user,
          },
        });
        return { requiresOtp: true, tempToken: result.tempToken, user: result.user };
      }

      if (isDeviceVerificationRequired(result)) {
        set({
          deviceVerification: {
            required: true,
            tempToken: result.tempToken,
            user: result.user ?? null,
            verification: result.verification,
          },
        });
        return {
          requiresDeviceVerification: true,
          tempToken: result.tempToken,
          user: result.user ?? null,
          verification: result.verification,
        };
      }

      saveStoredUser(result.user);
      setAccessToken(result.token);
      set({ user: result.user, token: result.token });
      return { requiresOtp: false, user: result.user, token: result.token };
    },

    async register(payload) {
      get().clearOtp();
      get().clearDeviceVerification();

      const raw = await authApi.register(payload);
      if (!raw) throw new Error('Register failed: empty response');

      const result = raw as Exclude<AuthResult, DeviceVerificationRequiredResult>;

      if (isOtpRequired(result)) {
        set({
          otp: {
            required: true,
            purpose: 'buyer_register_phone',
            tempToken: result.tempToken,
            phone: payload.phone ?? result.user.phone ?? null,
            user: result.user,
          },
        });
        return { requiresOtp: true, tempToken: result.tempToken, user: result.user };
      }

      saveStoredUser(result.user);
      setAccessToken(result.token);
      set({ user: result.user, token: result.token });
      return { requiresOtp: false, user: result.user, token: result.token };
    },

    async requestOtp(payload, token) {
      const purpose = (payload.purpose ?? get().otp.purpose ?? 'buyer_register_phone') as Purpose;
      const finalPayload = { ...payload, purpose };

      return await authApi.requestOtp(finalPayload, token ?? get().otp.tempToken ?? get().token);
    },

    async checkOtpStatus(requestId, token) {
      return await authApi.checkOtpStatus(requestId, token ?? get().otp.tempToken ?? get().token);
    },

    async checkDeviceVerificationStatus(token) {
      const authToken = token ?? get().deviceVerification.tempToken;
      if (!authToken) {
        throw new Error('Device verification token missing');
      }
      return await authApi.checkDeviceVerificationStatus(authToken);
    },

    async completeDeviceVerification(payload, token) {
      const authToken = token ?? get().deviceVerification.tempToken;
      if (!authToken) {
        throw new Error('Device verification token missing');
      }

      const result = await authApi.verifyDevice(payload, authToken);

      set({
        user: result.user,
        token: result.token,
        otp: { ...emptyOtp },
        deviceVerification: { ...emptyDeviceVerification },
      });
      saveStoredUser(result.user);
      setAccessToken(result.token);
    },

    async verifyOtp(payload, token) {
      const otp = get().otp;
      const purpose = (payload.purpose ?? otp.purpose ?? 'buyer_register_phone') as Purpose;

      const finalPayload = { ...payload, purpose };
      const result = await authApi.verifyOtp(finalPayload, token ?? otp.tempToken ?? get().token);

      if (!result?.user || !result?.token) {
        throw new Error('OTP verify failed: invalid response');
      }

      set({
        user: result.user,
        token: result.token,
        otp: { ...emptyOtp },
      });
      saveStoredUser(result.user);
      setAccessToken(result.token);
    },

    async updateProfile(payload) {
      const result = await authApi.updateProfile(payload);

      if (result?.user) {
        const user: User = {
          ...result.user,
          role: result.user.role as Role,
        };
        set({ user });
        saveStoredUser(user);
      }
    },

    setUser(user) {
      authApi.setSessionUser?.(user);
      saveStoredUser(user);
      set({ user });
    },

    async logout() {
      try {
        await authApi.logout();
      } catch {
        // ignore
      } finally {
        removeFromStorage(STORAGE_KEYS.session);
        setAccessToken(null);
        set({ user: null, token: null, otp: { ...emptyOtp }, deviceVerification: { ...emptyDeviceVerification } });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth:logout'));
        }
      }
    },

    hydrate() {
      const user = loadStoredUser();
      const token = loadStoredToken();
      set({ user, token });
    },
  };
});

if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    removeFromStorage(STORAGE_KEYS.session);
    setAccessToken(null);
    useAuthStore.setState({ user: null, token: null, otp: { ...emptyOtp }, deviceVerification: { ...emptyDeviceVerification } });
  });
}
