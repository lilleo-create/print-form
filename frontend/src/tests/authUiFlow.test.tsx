import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthPage } from '../pages/AuthPage';
import { useAuthStore } from '../app/store/authStore';

const baseUser = {
  id: 'user-1',
  email: 'user@example.com',
  phone: '79990000000',
  role: 'buyer',
  name: 'User'
} as never;

describe('Auth UI flow checks', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      otp: {
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
        updatedAt: null
      },
      login: async () => ({ requiresOtp: false, user: baseUser, token: 'token' }),
      register: async () => ({ requiresOtp: false, user: baseUser, token: 'token' }),
      requestOtp: async () => null,
      requestDeviceLoginOtp: async () => null,
      checkOtpStatus: async () => 'pending',
      verifyOtp: async () => undefined,
      verifyDeviceLoginOtp: async () => undefined,
      updateProfile: async () => undefined,
      setOtpState: () => undefined,
      clearOtp: () => undefined,
      setUser: () => undefined,
      logout: async () => undefined,
      hydrate: () => undefined
    });
  });

  it('keeps login error on screen when authorization fails', async () => {
    const loginMock = vi.fn(async () => {
      throw new Error('Unauthorized');
    });
    useAuthStore.setState({ login: loginMock });

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <AuthPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('+7 (___) ___-__-__'), {
      target: { value: '+7 (999) 000-00-00' }
    });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'wrongpass' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(screen.getByText('Неверный номер телефона или пароль.')).toBeInTheDocument();
    });

    expect(loginMock).toHaveBeenCalledWith('+79990000000', 'wrongpass');
    expect(screen.getByPlaceholderText('+7 (___) ___-__-__')).toBeInTheDocument();
  });

  it('submits login with typed password value', async () => {
    const loginMock = vi.fn(async () => ({ requiresOtp: false, user: baseUser, token: 'token' }));
    useAuthStore.setState({ login: loginMock });

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <AuthPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('+7 (___) ___-__-__'), {
      target: { value: '+7 (999) 000-00-00' }
    });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'buyer123' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('+79990000000', 'buyer123');
    });
  });

  it('shows password validation only after interaction and allows valid submit without Required', async () => {
    const registerMock = vi.fn(async () => ({ requiresOtp: false, user: baseUser, token: 'token' }));
    useAuthStore.setState({ register: registerMock });

    render(
      <MemoryRouter initialEntries={['/auth/register']}>
        <AuthPage />
      </MemoryRouter>
    );

    expect(screen.queryByText('Введите пароль')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'short' }
    });

    await waitFor(() => {
      expect(
        screen.getByText('Пароль должен содержать минимум 8 символов')
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'Valid123' }
    });
    fireEvent.change(screen.getByPlaceholderText('Повторите пароль'), {
      target: { value: 'Valid123' }
    });
    fireEvent.change(screen.getByPlaceholderText('Никнейм'), {
      target: { value: 'tester' }
    });
    fireEvent.change(screen.getByPlaceholderText('ФИО'), {
      target: { value: 'Тест Пользователь' }
    });
    fireEvent.change(screen.getByPlaceholderText('+7 (___) ___-__-__'), {
      target: { value: '+7 (999) 000-00-00' }
    });
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'user@example.com' }
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'Valid123',
          email: 'user@example.com',
          privacyAccepted: true
        })
      );
    });

    expect(screen.queryByText('Введите пароль')).not.toBeInTheDocument();
  });

  it('redirects login with new device to shared otp step', async () => {
    const loginMock = vi.fn(async () => ({
      requiresOtp: true,
      tempToken: 'temp-token',
      user: baseUser,
      flowType: 'device_login_verification',
      requestId: 'request-1',
      phone: '79990000000',
      verificationMethod: 'existing_otp_flow',
      otpRequest: {
        requestId: 'request-1',
        verificationType: 'call_to_auth' as const,
        callToAuthNumber: '79990000001',
        phone: '79990000000'
      },
      verification: {
        channel: 'PHONE_CALL',
        phone: '79990000000',
        reason: 'Новое устройство'
      }
    }));
    const requestOtpMock = vi.fn();

    useAuthStore.setState({ login: loginMock as never, requestOtp: requestOtpMock as never });

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <AuthPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('+7 (___) ___-__-__'), {
      target: { value: '+7 (999) 000-00-00' }
    });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'buyer123' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Подтвердите вход с нового устройства')).toBeInTheDocument();
    expect(screen.getByText('Позвоните на')).toBeInTheDocument();
    expect(screen.getByText('+7 (999) 000-00-01')).toBeInTheDocument();
    expect(screen.getByText('Ожидаем автоматическое подтверждение входа после звонка.')).toBeInTheDocument();
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it('keeps registration otp flow on screen and persists temp token', async () => {
    const registerMock = vi.fn(async () => ({
      requiresOtp: true,
      tempToken: 'temp-token',
      user: {
        ...baseUser,
        phone: '+79990000000'
      },
      flowType: 'registration' as const
    }));
    const requestOtpMock = vi.fn(async () => ({
      requestId: 'request-1',
      verificationType: 'call_to_auth' as const,
      callToAuthNumber: '79990000001',
      phone: '+79990000000'
    }));

    useAuthStore.setState({ register: registerMock as never, requestOtp: requestOtpMock as never });

    render(
      <MemoryRouter initialEntries={['/auth/register']}>
        <AuthPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Никнейм'), {
      target: { value: 'tester' }
    });
    fireEvent.change(screen.getByPlaceholderText('ФИО'), {
      target: { value: 'Тест Пользователь' }
    });
    fireEvent.change(screen.getByPlaceholderText('+7 (___) ___-__-__'), {
      target: { value: '+7 (999) 000-00-00' }
    });
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'user@example.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'Valid123' }
    });
    fireEvent.change(screen.getByPlaceholderText('Повторите пароль'), {
      target: { value: 'Valid123' }
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(await screen.findByText('Подтверждение номера')).toBeInTheDocument();
    expect(screen.getByText('Ожидаем автоматическое подтверждение после звонка.')).toBeInTheDocument();

    await waitFor(() => {
      expect(requestOtpMock).toHaveBeenCalledWith(
        { phone: '+79990000000', purpose: 'buyer_register_phone' },
        'temp-token'
      );
    });

    expect(JSON.parse(window.localStorage.getItem('pf_auth_otp_flow') ?? 'null')).toEqual(
      expect.objectContaining({
        required: true,
        tempToken: 'temp-token',
        phone: '+7 (999) 000-00-00',
        purpose: 'buyer_register_phone',
        flowType: 'registration'
      })
    );
  });

  it('verifies device login with active challenge phone in canonical format', async () => {
    const loginMock = vi.fn(async () => ({
      requiresOtp: true,
      tempToken: 'temp-token',
      user: baseUser,
      flowType: 'device_login_verification',
      requestId: 'request-1',
      phone: '+7 (999) 000-00-00',
      verificationMethod: 'existing_otp_flow',
      otpRequest: {
        requestId: 'request-1',
        verificationType: 'call_to_auth' as const,
        callToAuthNumber: '79990000001',
        phone: '79990000000'
      },
      verification: {
        channel: 'PHONE_CALL',
        phone: '79990000000',
        reason: 'Новое устройство'
      }
    }));
    const checkOtpStatusMock = vi.fn(async () => 'verified' as const);
    const verifyDeviceLoginOtpMock = vi.fn(async () => undefined);

    useAuthStore.setState({
      login: loginMock as never,
      checkOtpStatus: checkOtpStatusMock as never,
      verifyDeviceLoginOtp: verifyDeviceLoginOtpMock as never
    });

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <AuthPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('+7 (___) ___-__-__'), {
      target: { value: '+7 (999) 000-00-00' }
    });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'buyer123' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Подтвердите вход с нового устройства')).toBeInTheDocument();

    await waitFor(() => {
      expect(verifyDeviceLoginOtpMock).toHaveBeenCalledWith(
        { phone: '+79990000000', requestId: 'request-1', purpose: undefined },
        'temp-token'
      );
    }, { timeout: 4000 });
  });
});
