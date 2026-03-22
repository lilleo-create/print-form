import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { authApi } from '../shared/api/authApi';

vi.mock('../shared/api/authApi', () => ({
  authApi: {
    requestPasswordReset: vi.fn(),
    checkOtpStatus: vi.fn(),
    verifyPasswordReset: vi.fn(),
    confirmPasswordReset: vi.fn()
  }
}));

describe('Forgot password recovery flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('shows call confirmation UI without legacy code copy or early retry CTA', async () => {
    vi.mocked(authApi.requestPasswordReset).mockResolvedValue({
      requiresOtp: true,
      flowType: 'password_reset_verification',
      tempToken: 'temp-token',
      phone: '79990000000',
      requestId: 'req-1',
      otpRequest: {
        requestId: 'req-1',
        verificationType: 'call_to_auth',
        callToAuthNumber: '78005553535',
        phone: '79990000000',
        expiresInSec: 120
      }
    } as never);
    vi.mocked(authApi.checkOtpStatus).mockResolvedValue('pending' as never);

    render(
      <MemoryRouter initialEntries={['/auth/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('+7 (___) ___-__-__'), {
      target: { value: '+7 (999) 000-00-00' }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    });

    expect(await screen.findByText('Подтвердите восстановление пароля')).toBeInTheDocument();
    expect(screen.getByText(/После звонка подтверждение завершится автоматически/i)).toBeInTheDocument();
    expect(screen.queryByText('Код подтверждения')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Запросить звонок повторно' })).not.toBeInTheDocument();
  });

  it('shows retry CTA after confirmation timeout', async () => {
    vi.mocked(authApi.requestPasswordReset).mockResolvedValue({
      requiresOtp: true,
      flowType: 'password_reset_verification',
      tempToken: 'temp-token',
      phone: '79990000000',
      requestId: 'req-1',
      otpRequest: {
        requestId: 'req-1',
        verificationType: 'call_to_auth',
        callToAuthNumber: '78005553535',
        phone: '79990000000',
        expiresInSec: 5
      }
    } as never);
    vi.mocked(authApi.checkOtpStatus).mockResolvedValue('expired' as never);

    render(
      <MemoryRouter initialEntries={['/auth/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('+7 (___) ___-__-__'), {
      target: { value: '+7 (999) 000-00-00' }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    });

    expect(await screen.findByText('Подтвердите восстановление пароля')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Запросить звонок повторно' })).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByText('Время ожидания звонка истекло. Запросите подтверждение снова.')).toBeInTheDocument();

  }, 10000);
});
