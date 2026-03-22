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
        user: null
      },
      login: async () => ({ requiresOtp: false, user: baseUser, token: 'token' }),
      register: async () => ({ requiresOtp: false, user: baseUser, token: 'token' }),
      requestOtp: async () => null,
      checkOtpStatus: async () => 'pending',
      verifyOtp: async () => undefined,
      updateProfile: async () => undefined,
      setOtpState: () => undefined,
      clearOtp: () => undefined,
      setUser: () => undefined,
      logout: async () => undefined,
      hydrate: () => undefined
    });
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
});
